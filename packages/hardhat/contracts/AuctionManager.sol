// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StableToken.sol";

contract AuctionManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        address stableToken;
        uint64 biddingEnds;
        bool finalized;
        bool usesEncrypted;
        uint256 minDeposit;
        address winner;
        uint256 bidCount; 
    }

    struct EncryptedEntry {
        bytes ciphertext;
        address bidder;
        uint256 deposit;
    }

    uint256 public nextAuction;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public bids;
    mapping(uint256 => address[]) public bidders;
    mapping(uint256 => EncryptedEntry[]) public encryptedBids;

    event AuctionCreated(uint256 indexed id, address seller, address nftContract, uint256 tokenId, uint64 biddingEnds, bool encrypted);
    event BidPlaced(uint256 indexed id, address indexed bidder, uint256 amount);
    event EncryptedBidSubmitted(uint256 indexed id, address indexed bidder, uint256 deposit);
    event AuctionFinalized(uint256 indexed id, address winner, uint256 amount);
    event AuctionCancelled(uint256 indexed id); // NOVO
    event RefundIssued(uint256 indexed id, address indexed to, uint256 amount);

    // ---------- create auction ----------
    function createAuction(
        address nftContract,
        uint256 tokenId,
        address stableToken,
        uint64 biddingEnds,
        bool usesEncrypted,
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
            false,
            usesEncrypted,
            minDeposit,
            address(0), // winner
            0 // bidCount
        );

        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        emit AuctionCreated(id, msg.sender, nftContract, tokenId, biddingEnds, usesEncrypted);
        return id;
    }

    // ---------- plaintext bids (simples) ----------
    function placeBid(uint256 auctionId, uint256 amount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(!a.usesEncrypted, "auction is encrypted mode");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(amount > 0, "zero bid");

        if (bids[auctionId][msg.sender] == 0) {
            bidders[auctionId].push(msg.sender);
        }

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), amount);
        bids[auctionId][msg.sender] += amount;
        a.bidCount++; 

        emit BidPlaced(auctionId, msg.sender, bids[auctionId][msg.sender]);
    }

    // ---------- encrypted bids ----------
    function submitEncryptedBid(uint256 auctionId, bytes calldata ciphertext, uint256 depositAmount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.usesEncrypted, "auction not encrypted");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(depositAmount >= a.minDeposit, "deposit too small");

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        a.bidCount++; 

        encryptedBids[auctionId].push(EncryptedEntry({
            ciphertext: ciphertext,
            bidder: msg.sender,
            deposit: depositAmount
        }));

        emit EncryptedBidSubmitted(auctionId, msg.sender, depositAmount);
    }

    // ---------- finalize ----------
    function finalizeWithProof(uint256 auctionId, address winner, uint256 winningAmount, bytes calldata proof) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        require(a.bidCount > 0, "No bids placed"); // Não se pode finalizar sem lances

        require(verifyProof(auctionId, winner, winningAmount, proof), "invalid proof");

        uint256 paid = 0;
        if (a.usesEncrypted) {
            // ... (lógica de lances criptografados) ...
            revert("Encrypted finalization logic not shown");
        } else {
            // Modo Plaintext
            uint256 bidderAmount = bids[auctionId][winner];
            require(bidderAmount >= winningAmount, "winner bid insufficient");
            bids[auctionId][winner] = bidderAmount - winningAmount;
            paid = winningAmount;
        }

        IERC20(a.stableToken).safeTransfer(a.seller, paid);
        IERC721(a.nftContract).transferFrom(address(this), winner, a.tokenId);

        a.finalized = true;
        a.winner = winner;
        emit AuctionFinalized(auctionId, winner, paid);
    }

    /**
     * @dev: Permite o vendedor cancelar e pegar o NFT de volta SE o leilão acabou E NINGUÉM deu lance.
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        require(msg.sender == a.seller, "Not seller");
        require(a.bidCount == 0, "Auction has bids");

        a.finalized = true; // Fecha o leilão

        // Devolve o NFT para o vendedor
        IERC721(a.nftContract).transferFrom(address(this), a.seller, a.tokenId);
        emit AuctionCancelled(auctionId);
    }

    // refund losers
    function refundLosers(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.finalized, "not finalized");

        if (a.usesEncrypted) {
            // ... (lógica de reembolso criptografado) ...
        } else {
            // Reembolsa depósitos restantes de lances plaintext
            uint256 len = bidders[auctionId].length;
            for (uint256 i = 0; i < len; i++) {
                address bidder = bidders[auctionId][i];
                uint256 amount = bids[auctionId][bidder];
                
                if (amount > 0) {
                    bids[auctionId][bidder] = 0;
                    IERC20(a.stableToken).safeTransfer(bidder, amount);
                    emit RefundIssued(auctionId, bidder, amount);
                }
            }
        }
    }

    // --------- proof verification (stub) ----------
    function verifyProof(uint256 /*auctionId*/, address /*winner*/, uint256 /*winningAmount*/, bytes calldata /*proof*/) internal view returns (bool) {
        return msg.sender == owner();
    }

    // ... (funções de admin rescue) ...
}