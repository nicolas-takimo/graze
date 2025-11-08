// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// --- FHE ---
import "fhevm/lib/FHE.sol"; 

contract AuctionManagerFHE is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public feeRecipient;
    uint256 public feeBps;
    uint256 public constant BPS = 10_000;
    uint256 public nextAuction;

    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        address stableToken;
        uint64 biddingEnds;
        bool finalized;
        uint256 minDeposit;
    }

    struct EncryptedBid {
        address bidder;
        euint32 encryptedAmount;
        uint256 deposit;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => EncryptedBid[]) public auctionBids;

    event AuctionCreated(uint256 indexed id, address seller, address nftContract, uint256 tokenId, uint64 biddingEnds);
    event EncryptedBidSubmitted(uint256 indexed id, address indexed bidder, uint256 deposit);
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
            false,
            minDeposit
        );
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        emit AuctionCreated(id, msg.sender, nftContract, tokenId, biddingEnds);
        return id;
    }

    // CORRIGIDO PARA A API ANTIGA
    function submitEncryptedBid(uint256 auctionId, bytes calldata ciphertext, uint256 depositAmount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(depositAmount >= a.minDeposit, "deposit too small");

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // FHE.asEencrypted é a função correta na API ANTIGA
        euint32 encryptedBid = FHE.asEencrypted(ciphertext);
        
        auctionBids[auctionId].push(EncryptedBid({
            bidder: msg.sender,
            encryptedAmount: encryptedBid,
            deposit: depositAmount
        }));
        emit EncryptedBidSubmitted(auctionId, msg.sender, depositAmount);
    }

    // CORRIGIDO PARA A API ANTIGA
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        EncryptedBid[] storage bids = auctionBids[auctionId];
        uint256 bidCount = bids.length;
        require(bidCount > 0, "No bids placed");

        // FHE.asEuint32(0) é o correto na API ANTIGA
        euint32 highestBidAmount = FHE.asEuint32(0); 
        address winner = address(0);
        uint256 winnerIndex = 0;

        for (uint256 i = 0; i < bidCount; i++) {
            euint32 currentBidAmount = bids[i].encryptedAmount;
            
            // .gt() é o correto na API ANTIGA
            ebool isHigher = currentBidAmount.gt(highestBidAmount);
            
            // FHE.ternary() é o correto na API ANTIGA
            highestBidAmount = FHE.ternary(isHigher, currentBidAmount, highestBidAmount);
            winner = FHE.ternary(isHigher, bids[i].bidder, winner);
            winnerIndex = FHE.ternary(isHigher, i, winnerIndex);
        }

        // .decrypt() é o correto na API ANTIGA
        uint256 winningAmount = highestBidAmount.decrypt();

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

  D      bids[winnerIndex].deposit -= winningAmount;
        a.finalized = true;
        emit AuctionFinalized(auctionId, winner, winningAmount, fee);
    }
    
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        require(msg.sender == a.seller, "Not seller");
        require(auctionBids[auctionId].length == 0, "Auction has bids");
        a.finalized = true;
        IERC721(a.nftContract).transferFrom(address(this), a.seller, a.tokenId);
        emit AuctionCancelled(auctionId);
    }

    function refundLosers(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.finalized, "not finalized");
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