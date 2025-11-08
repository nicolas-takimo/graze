// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AuctionManager
 * @dev Manages ERC721 auctions (AgroAsset) using an ERC20 (StableToken) for payment.
 * Includes logic for plaintext auctions and stubs for encrypted (FHE) auctions.
 * Implements a platform fee (feeBps) paid to a designated feeRecipient.
 * Allows sellers to cancel auctions that end with no bids.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StableToken.sol";

contract AuctionManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // --- State Variables ---

    address public feeRecipient; // The address that receives platform fees
    uint256 public feeBps; // The platform fee, in basis points (e.g., 250 = 2.5%)
    uint256 public constant BPS = 10_000;

    uint256 public nextAuction;

    // --- Data Structures ---

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
        uint256 bidCount; // Tracks the number of bids placed
    }

    struct EncryptedEntry {
        bytes ciphertext;
        address bidder;
        uint256 deposit;
    }

    // --- Storage Mappings ---

    mapping(uint256 => Auction) public auctions;

    // Plaintext bid storage
    mapping(uint256 => mapping(address => uint256)) public bids;
    mapping(uint256 => address[]) public bidders; // List for plaintext refunds

    // Encrypted bid storage (for FHE)
    mapping(uint256 => EncryptedEntry[]) public encryptedBids;

    // --- Events ---

    event AuctionCreated(
        uint256 indexed id,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint64 biddingEnds,
        bool encrypted
    );
    event BidPlaced(uint256 indexed id, address indexed bidder, uint256 amount);
    event EncryptedBidSubmitted(uint256 indexed id, address indexed bidder, uint256 deposit);
    event AuctionFinalized(uint256 indexed id, address winner, uint256 amount, uint256 fee);
    event AuctionCancelled(uint256 indexed id);
    event RefundIssued(uint256 indexed id, address indexed to, uint256 amount);
    event FeeRecipientChanged(address newRecipient);
    event FeeBpsChanged(uint256 newFeeBps);

    // --- Constructor ---

    /**
     * @param _initialFeeRecipient The address of the treasury that will receive fees.
     * @param _initialFeeBps The initial platform fee (e.g., 250 for 2.5%).
     */
    constructor(address _initialFeeRecipient, uint256 _initialFeeBps) {
        require(_initialFeeRecipient != address(0), "Recipient cannot be zero address");
        require(_initialFeeBps <= 1000, "Fee too high"); // 10% cap

        feeRecipient = _initialFeeRecipient;
        feeBps = _initialFeeBps;
    }

    // --- 1. Auction Creation ---

    /**
     * @dev Creates a new auction for an ERC721 token.
     * The seller must have approved this contract to transfer the NFT.
     */
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
            false, // finalized
            usesEncrypted,
            minDeposit,
            address(0), // winner
            0 // bidCount
        );

        // This contract now holds the NFT in escrow
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        emit AuctionCreated(id, msg.sender, nftContract, tokenId, biddingEnds, usesEncrypted);
        return id;
    }

    // --- 2. Bidding Logic (Plaintext) ---

    /**
     * @dev Places a simple plaintext bid.
     * The bidder must have approved this contract to transfer the stableToken.
     */
    function placeBid(uint256 auctionId, uint256 amount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(!a.usesEncrypted, "auction is encrypted mode");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(amount > 0, "zero bid");

        // Add to refund list if this is their first bid
        if (bids[auctionId][msg.sender] == 0) {
            bidders[auctionId].push(msg.sender);
        }

        // Pull the stablecoin from the user into this contract's escrow
        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), amount);
        bids[auctionId][msg.sender] += amount;
        a.bidCount++;

        emit BidPlaced(auctionId, msg.sender, bids[auctionId][msg.sender]);
    }

    // --- 3. Bidding Logic (Encrypted - FHE Stub) ---

    /**
     * @dev Submits an encrypted bid and a deposit (for FHE).
     * The bidder must approve the stableToken deposit.
     */
    function submitEncryptedBid(
        uint256 auctionId,
        bytes calldata ciphertext,
        uint256 depositAmount
    ) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.usesEncrypted, "auction not encrypted");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(depositAmount >= a.minDeposit, "deposit too small");

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        a.bidCount++;

        encryptedBids[auctionId].push(
            EncryptedEntry({ ciphertext: ciphertext, bidder: msg.sender, deposit: depositAmount })
        );

        emit EncryptedBidSubmitted(auctionId, msg.sender, depositAmount);
    }

    // --- 4. Finalization and Payout ---

    /**
     * @dev Finalizes an auction, paying the seller and fee recipient.
     * Requires a 'proof' which, in this stub, is just an owner check.
     */
    function finalizeWithProof(
        uint256 auctionId,
        address winner,
        uint256 winningAmount,
        bytes calldata proof
    ) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        require(a.bidCount > 0, "No bids placed");

        // This is the centralized stub to be replaced by FHE
        require(verifyProof(auctionId, winner, winningAmount, proof), "invalid proof");

        uint256 paid = 0;
        if (a.usesEncrypted) {
            // FHE-based logic would go here to decrypt/find winner
            revert("Encrypted finalization logic not implemented");
        } else {
            // Plaintext logic
            uint256 bidderAmount = bids[auctionId][winner];
            require(bidderAmount >= winningAmount, "winner bid insufficient");

            // Set the winner's remaining deposit, ready for refund
            bids[auctionId][winner] = bidderAmount - winningAmount;
            paid = winningAmount;
        }

        // --- Fee Logic ---
        uint256 fee = 0;
        uint256 sellerProceeds = paid;

        if (feeBps > 0) {
            fee = (paid * feeBps) / BPS;
            sellerProceeds = paid - fee;

            // Transfer the fee to the designated treasury
            IERC20(a.stableToken).safeTransfer(feeRecipient, fee);
        }

        // Pay the seller the net proceeds
        IERC20(a.stableToken).safeTransfer(a.seller, sellerProceeds);
        // --- End Fee Logic ---

        // Transfer the NFT to the winner
        IERC721(a.nftContract).transferFrom(address(this), winner, a.tokenId);

        a.finalized = true;
        a.winner = winner;
        emit AuctionFinalized(auctionId, winner, paid, fee);
    }

    // --- 5. Edge Case Logic (Cancel & Refund) ---

    /**
     * @dev Allows the seller to cancel and retrieve their NFT
     * ONLY IF the auction has ended AND no bids were placed.
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(block.timestamp >= a.biddingEnds, "bidding not ended");
        require(!a.finalized, "already finalized");
        require(msg.sender == a.seller, "Not seller");
        require(a.bidCount == 0, "Auction has bids");

        a.finalized = true; // Close the auction

        // Return the NFT to the seller
        IERC721(a.nftContract).transferFrom(address(this), a.seller, a.tokenId);
        emit AuctionCancelled(auctionId);
    }

    /**
     * @dev Refunds all losing bids and any remaining deposit from the winner.
     */
    function refundLosers(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.finalized, "not finalized");

        if (a.usesEncrypted) {
            // FHE-based refund logic would go here
            revert("Encrypted refund logic not implemented");
        } else {
            // Plaintext refund logic
            uint256 len = bidders[auctionId].length;
            for (uint256 i = 0; i < len; i++) {
                address bidder = bidders[auctionId][i];
                // 'bids[auctionId][bidder]' holds the remaining deposit
                uint256 amount = bids[auctionId][bidder];

                if (amount > 0) {
                    bids[auctionId][bidder] = 0;
                    IERC20(a.stableToken).safeTransfer(bidder, amount);
                    emit RefundIssued(auctionId, bidder, amount);
                }
            }
        }
    }

    // --- 6. Admin & Stubs ---

    /**
     * @dev Sets the platform fee (in BPS). Only owner.
     * @param _newFeeBps The new fee, e.g., 250 for 2.5%.
     */
    function setFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Tax too high"); // 10% cap
        feeBps = _newFeeBps;
        emit FeeBpsChanged(_newFeeBps);
    }

    /**
     * @dev Sets the new treasury address that receives fees. Only owner.
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Recipient cannot be zero address");
        feeRecipient = _newRecipient;
        emit FeeRecipientChanged(_newRecipient);
    }

    /**
     * @dev STUB - Centralized proof verification to be replaced by FHE.
     */
    function verifyProof(
        uint256 /*auctionId*/,
        address /*winner*/,
        uint256 /*winningAmount*/,
        bytes calldata /*proof*/
    ) internal view returns (bool) {
        // WARNING: This is centralized. Only the contract owner can finalize.
        // Replace with a trustless FHE or ZK proof verifier for production.
        return msg.sender == owner();
    }
}
