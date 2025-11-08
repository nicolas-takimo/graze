// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// --- FHE Import ---
import "@fhevm/solidity/lib/FHE.sol"; 

contract AuctionManagerFHE is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public feeRecipient;
    uint256 public feeBps;
    uint256 public constant BPS = 10_000;
    uint256 public nextAuction;

    enum AuctionStatus { Open, AwaitingDecryption, Closed }

    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        address stableToken;
        uint64 biddingEnds;
        AuctionStatus status; // <- Mudança de bool para enum
        uint256 minDeposit;
        // Campos para armazenar os resultados criptografados
        euint32 highestBid;
        euint256 winnerIndex;
    }

    struct EncryptedBid {
        address bidder;
        euint32 encryptedAmount;
        uint256 deposit;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => EncryptedBid[]) public auctionBids;

    // --- Eventos ---
    event AuctionCreated(uint256 indexed id, address seller, address nftContract, uint256 tokenId, uint64 biddingEnds);
    event EncryptedBidSubmitted(uint256 indexed id, address indexed bidder, uint256 deposit);
    // Evento para o relayer ouvir
    event DecryptionRequested(uint256 indexed auctionId, bytes32 highestBidHandle, bytes32 winnerIndexHandle);
    event AuctionFinalized(uint256 indexed id, address winner, uint256 amount, uint256 fee);
    event AuctionCancelled(uint256 indexed id);
    event RefundIssued(uint256 indexed id, address indexed to, uint256 amount);
    event FeeRecipientChanged(address newRecipient);
    event FeeBpsChanged(uint256 newFeeBps);


    constructor(address _initialFeeRecipient, uint256 _initialFeeBps) {
        require(_initialFeeRecipient != address(0), "Recipient cannot be zero address");
        require(_initialFeeBps <= 1000, "Fee too high");
        feeRecipient = _initialFeeRecipient;
        feeBps = _initialFeeBps;
    }

    function createAuction(
        address nftContract,
        uint256 tokenId,
        address stableToken,
        uint64 biddingEnds,
        uint256 minDeposit
    ) external nonReentrant returns (uint256) {
        require(biddingEnds > block.timestamp, "end must be future");
        uint256 id = nextAuction++;
        auctions[id] = Auction(
            msg.sender,
            nftContract,
            tokenId,
            stableToken,
            biddingEnds,
            AuctionStatus.Open, // <- Mudança
            minDeposit,
            FHE.asEuint32(0), // Inicializa highestBid
            FHE.asEuint256(0) // Inicializa winnerIndex
        );
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        emit AuctionCreated(id, msg.sender, nftContract, tokenId, biddingEnds);
        return id;
    }

    // --- CORRIGIDO PARA A API NOVA (FHE.fromExternal) ---
    function submitEncryptedBid(
        uint256 auctionId,
        externalEuint32 bidHandle, // O "handle" do ciphertext
        bytes calldata bidProof,  // A prova
        uint256 depositAmount
    ) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.status == AuctionStatus.Open, "Auction not open");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(depositAmount >= a.minDeposit, "deposit too small");

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // CORRETO: FHE.fromExternal (baseado no seu FHE.sol)
        euint32 encryptedBid = FHE.fromExternal(bidHandle, bidProof);
        
        auctionBids[auctionId].push(EncryptedBid({
            bidder: msg.sender,
            encryptedAmount: encryptedBid,
            deposit: depositAmount
        }));
        emit EncryptedBidSubmitted(auctionId, msg.sender, depositAmount);
    }

    // --- CORRIGIDO PARA A API NOVA (Sem .decrypt) ---
    // Esta função agora APENAS encontra o vencedor e REQUISITA a descriptografia
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(a.status == AuctionStatus.Open, "already finalized");
        EncryptedBid[] storage bids = auctionBids[auctionId];
        uint256 bidCount = bids.length;
        require(bidCount > 0, "No bids placed");

        // CORRETO: Sintaxe da API nova para criar um euint32 com valor 0
        euint32 highestBidAmount = FHE.asEuint32(0); 
        euint256 winnerIndexEncrypted = FHE.asEuint256(0);

        for (uint256 i = 0; i < bidCount; i++) {
            euint32 currentBidAmount = bids[i].encryptedAmount;
            
            // CORRETO: FHE.gt (baseado no seu FHE.sol)
            ebool isHigher = FHE.gt(currentBidAmount, highestBidAmount);
            
            // CORRETO: FHE.select (baseado no seu FHE.sol)
            highestBidAmount = FHE.select(isHigher, currentBidAmount, highestBidAmount);
            winnerIndexEncrypted = FHE.select(isHigher, FHE.asEuint256(i), winnerIndexEncrypted);
        }

        // Armazena os resultados criptografados
        a.highestBid = highestBidAmount;
        a.winnerIndex = winnerIndexEncrypted;
        a.status = AuctionStatus.AwaitingDecryption;

        // Emite o evento para o Relayer
        emit DecryptionRequested(
            auctionId,
            FHE.toBytes32(highestBidAmount), // Converte para o handle
            FHE.toBytes32(winnerIndexEncrypted) // Converte para o handle
        );
    }

    // --- NOVA FUNÇÃO (para o Relayer chamar) ---
    function fulfillAuction(
        uint256 auctionId,
        bytes calldata decryptedData, // (winningAmount, winnerIndex)
        bytes calldata decryptionProof
    ) external nonReentrant { // Idealmente: onlyRelayer
        Auction storage a = auctions[auctionId];
        require(a.status == AuctionStatus.AwaitingDecryption, "Not awaiting decryption");

        // 1. Prepara a lista de handles que pedimos
        bytes32[] memory handlesList = new bytes32[](2);
        handlesList[0] = FHE.toBytes32(a.highestBid);
        handlesList[1] = FHE.toBytes32(a.winnerIndex);

        // 2. Verifica a prova do KMS
        bool isValid = FHE.verifySignatures(handlesList, decryptedData, decryptionProof);
        if (!isValid) {
            revert FHE.InvalidKMSSignatures();
        }

        // 3. Desempacota os valores descriptografados
        (uint256 winningAmount, uint256 winnerIndex) = abi.decode(decryptedData, (uint256, uint256));

        // --- O resto da sua lógica original ---
        EncryptedBid[] storage bids = auctionBids[auctionId];
        address winner = bids[winnerIndex].bidder;
        uint256 winnerDeposit = bids[winnerIndex].deposit;
        
        require(winnerDeposit >= winningAmount, "Winner deposit insufficient for bid");

        uint256 fee = 0;
        uint256 sellerProceeds = winningAmount;
        if (feeBps > 0) {
            fee = (winningAmount * feeBps) / BPS;
            sellerProceeds = winningAmount - fee;
            IERC20(a.stableToken).safeTransfer(feeRecipient, fee);
        }

        IERC20(a.stableToken).safeTransfer(a.seller, sellerProceeds);
        IERC721(a.nftContract).transferFrom(address(this), winner, a.tokenId);

        bids[winnerIndex].deposit -= winningAmount;
        a.status = AuctionStatus.Closed;
        emit AuctionFinalized(auctionId, winner, winningAmount, fee);
    }
    
    // --- Funções restantes (com pequenas mudanças de status) ---
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(a.status == AuctionStatus.Open, "already finalized"); // Só pode cancelar se estiver Open
        require(msg.sender == a.seller, "Not seller");
        require(auctionBids[auctionId].length == 0, "Auction has bids");
        
        a.status = AuctionStatus.Closed;
        IERC721(a.nftContract).transferFrom(address(this), a.seller, a.tokenId);
        emit AuctionCancelled(auctionId);
    }

    function refundLosers(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.status == AuctionStatus.Closed, "not closed"); // Só reembolsa depois de fechado
        uint256 len = auctionBids[auctionId].length;
        for (uint256 i = 0; i < len; i++) {
            EncryptedBid storage bid = auctionBids[auctionId][i];
            uint256 amount = bid.deposit;
            if (amount > 0) {
                bid.deposit = 0;
                IERC20(a.stableToken).safeTransfer(bid.bidder, amount);
                emit RefundIssued(auctionId, bid.bidder, amount);
            }
        }
    }

    function setFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Tax too high");
        feeBps = _newFeeBps;
        emit FeeBpsChanged(_newFeeBps);
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Recipient cannot be zero address");
        feeRecipient = _newRecipient;
        emit FeeRecipientChanged(_newRecipient);
    }
}