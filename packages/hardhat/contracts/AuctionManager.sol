// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * AuctionManager.sol
 * - Create sealed-bid auctions for AssetNFTs (ERC721)
 * - Supports plaintext bids and encrypted bids (FHE integration stub).
 * - Finalization requires verifyProof (stubbed to owner for testing).
 */

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
        bool usesEncrypted; // if true, bids are ciphertexts
        uint256 minDeposit;  // min deposit required to submit encrypted bid
    }

    struct EncryptedEntry {
        bytes ciphertext;
        address bidder;
        uint256 deposit; // escrowed stable amount for this encrypted bid
    }

    uint256 public nextAuction;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public bids;
    mapping(uint256 => uint256) public escrowTotal;
    mapping(uint256 => EncryptedEntry[]) public encryptedBids;

    event AuctionCreated(uint256 indexed id, address seller, address nftContract, uint256 tokenId, uint64 biddingEnds, bool encrypted);
    event BidPlaced(uint256 indexed id, address indexed bidder, uint256 amount);
    event EncryptedBidSubmitted(uint256 indexed id, address indexed bidder, uint256 deposit);
    event AuctionFinalized(uint256 indexed id, address winner, uint256 amount);
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
        auctions[id] = Auction(msg.sender, nftContract, tokenId, stableToken, biddingEnds, false, usesEncrypted, minDeposit);

        // transfer NFT to contract (seller must approve)
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(id, msg.sender, nftContract, tokenId, biddingEnds, usesEncrypted);
        return id;
    }

    // ---------- plaintext bids (simple) ----------
    function placeBid(uint256 auctionId, uint256 amount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(!a.usesEncrypted, "auction is encrypted mode");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(amount > 0, "zero bid");

        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), amount);
        bids[auctionId][msg.sender] += amount;
        escrowTotal[auctionId] += amount;

        emit BidPlaced(auctionId, msg.sender, bids[auctionId][msg.sender]);
    }

    // ---------- encrypted bids ----------
    function submitEncryptedBid(uint256 auctionId, bytes calldata ciphertext, uint256 depositAmount) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.usesEncrypted, "auction not encrypted");
        require(block.timestamp < a.biddingEnds, "bidding closed");
        require(depositAmount >= a.minDeposit, "deposit too small");

        // transfer stable deposit into escrow
        IERC20(a.stableToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        escrowTotal[auctionId] += depositAmount;

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

        require(verifyProof(auctionId, winner, winningAmount, proof), "invalid proof");

        uint256 paid = 0;
        if (a.usesEncrypted) {
            uint256 len = encryptedBids[auctionId].length;
            bool found = false;
            uint256 winnerDepositIndex = type(uint256).max;
            for (uint256 i = 0; i < len; i++) {
                if (encryptedBids[auctionId][i].bidder == winner) {
                    found = true;
                    winnerDepositIndex = i;
                    break;
                }
            }
            require(found, "winner deposit not found");
            EncryptedEntry memory e = encryptedBids[auctionId][winnerDepositIndex];
            require(e.deposit >= winningAmount, "winner deposit insufficient");

            escrowTotal[auctionId] -= winningAmount;
            encryptedBids[auctionId][winnerDepositIndex].deposit = e.deposit - winningAmount;
            paid = winningAmount;
        } else {
            uint256 bidderAmount = bids[auctionId][winner];
            require(bidderAmount >= winningAmount, "winner bid insufficient");
            bids[auctionId][winner] = bidderAmount - winningAmount;
            escrowTotal[auctionId] -= winningAmount;
            paid = winningAmount;
        }

        IERC20(a.stableToken).safeTransfer(a.seller, paid);
        IERC721(a.nftContract).transferFrom(address(this), winner, a.tokenId);

        a.finalized = true;
        emit AuctionFinalized(auctionId, winner, paid);
    }

    // refund losers (callable by anyone after finalize)
    function refundLosers(uint256 auctionId, uint256 startIndex, uint256 endIndex) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.finalized, "not finalized");
        if (a.usesEncrypted) {
            uint256 len = encryptedBids[auctionId].length;
            require(startIndex < len && endIndex <= len && startIndex < endIndex, "bad range");
            for (uint256 i = startIndex; i < endIndex; i++) {
                EncryptedEntry memory e = encryptedBids[auctionId][i];
                uint256 amount = e.deposit;
                if (amount > 0) {
                    encryptedBids[auctionId][i].deposit = 0;
                    escrowTotal[auctionId] -= amount;
                    IERC20(a.stableToken).safeTransfer(e.bidder, amount);
                    emit RefundIssued(auctionId, e.bidder, amount);
                }
            }
        } else {
            revert("plaintext refund needs bidder list support");
        }
    }

    // --------- proof verification (stub) ----------
    function verifyProof(uint256 /*auctionId*/, address /*winner*/, uint256 /*winningAmount*/, bytes calldata /*proof*/) internal view returns (bool) {
        return msg.sender == owner();
    }

    // admin rescue
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueNFT(address nftContract, uint256 tokenId, address to) external onlyOwner {
        IERC721(nftContract).transferFrom(address(this), to, tokenId);
    }
}
