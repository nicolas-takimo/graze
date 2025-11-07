// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * StableSwap.sol (MVP)
 * - Accepts ETH (native) or ERC20 (optional) as collateral and mints StableToken.
 * - Uses an AggregatorV3Interface-like oracle (Chainlink) which returns price scaled (e.g., 1e8 or other).
 * - For simplicity this contract normalizes price to 1e18 inside getNormalizedPrice().
 *
 * IMPORTANT: MVP for testnet. Production requires reserves management, redemption queue, oracle safety checks, caps, pausing.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./StableToken.sol";

contract StableSwap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    StableToken public stable;
    AggregatorV3Interface public priceFeed; // ETH/USD or token/USD

    // Optional: a supported ERC20 collateral (e.g., WETH) - if address(0) accept native ETH only
    IERC20 public acceptedToken;
    bool public acceptNativeETH;

    uint256 public feeBps = 50; // 0.50% fee default
    uint256 public constant BPS = 10_000;

    event BoughtStable(address indexed user, uint256 collateralAmount, uint256 stableMinted, bool isETH);
    event Redeemed(address indexed user, uint256 stableBurned, uint256 collateralSent, bool isETH);

    constructor(address _priceFeed, address _acceptedToken, bool _acceptNativeETH, address stableAddr) {
        require(_priceFeed != address(0), "price feed required");
        priceFeed = AggregatorV3Interface(_priceFeed);
        acceptedToken = IERC20(_acceptedToken);
        acceptNativeETH = _acceptNativeETH;
        stable = StableToken(stableAddr);
    }

    // normalize price to 1e18 scale (e.g., Chainlink 1e8 => *1e10)
    function getNormalizedPrice() public view returns (uint256) {
        (, int256 p, , , ) = priceFeed.latestRoundData();
        require(p > 0, "invalid price");
        uint8 d = priceFeed.decimals();
        uint256 up = uint256(p);
        if (d == 18) return up;
        if (d < 18) return up * (10 ** (18 - d));
        return up / (10 ** (d - 18));
    }

    // user sends native ETH
    function buyStableWithETH() external payable nonReentrant {
        require(acceptNativeETH, "native ETH not accepted");
        require(msg.value > 0, "zero");
        uint256 price = getNormalizedPrice(); // USD per ETH with 1e18
        // valueUSD = msg.value (wei, 1e18) * price (1e18) / 1e18 => 1e18
        uint256 valueUSD = (msg.value * price) / (1e18);
        uint256 valueAfterFee = (valueUSD * (BPS - feeBps)) / BPS;
        // stable has 18 decimals => amount to mint = valueAfterFee (already 1e18)
        uint256 mintAmount = valueAfterFee;
        stable.mint(msg.sender, mintAmount);
        emit BoughtStable(msg.sender, msg.value, mintAmount, true);
    }

    // user sends accepted ERC20 token (must approve)
    function buyStableWithToken(uint256 tokenAmount) external nonReentrant {
        require(address(acceptedToken) != address(0), "no token configured");
        require(tokenAmount > 0, "zero");
        // transfer token here
        acceptedToken.safeTransferFrom(msg.sender, address(this), tokenAmount);
        // we need token decimals to normalize; assume token decimals = 18 for MVP
        // For production read decimals() and normalize accordingly.
        uint256 price = getNormalizedPrice(); // price = USD per token (1e18)
        uint256 valueUSD = (tokenAmount * price) / (1e18); // result 1e18
        uint256 valueAfterFee = (valueUSD * (BPS - feeBps)) / BPS;
        uint256 mintAmount = valueAfterFee;
        stable.mint(msg.sender, mintAmount);
        emit BoughtStable(msg.sender, tokenAmount, mintAmount, false);
    }

    // redeem stable to ETH or token. user must approve stable to this contract
    function redeemToETH(uint256 stableAmount) external nonReentrant {
        require(acceptNativeETH, "native ETH not accepted");
        require(stableAmount > 0, "zero");
        // transfer stable from user and burn
        stable.transferFrom(msg.sender, address(this), stableAmount);
        stable.burn(address(this), stableAmount);

        uint256 price = getNormalizedPrice();
        // collateralWei = stableAmount (USD 1e18) * 1e18 / price (USD per ETH) => wei
        uint256 collateralWei = (stableAmount * 1e18) / price;
        // apply fee on redemption (optional) -> send less
        uint256 collateralAfterFee = (collateralWei * (BPS - feeBps)) / BPS;

        // check contract balance
        require(address(this).balance >= collateralAfterFee, "insufficient ETH reserves");
        (bool sent, ) = msg.sender.call{value: collateralAfterFee}("");
        require(sent, "ETH transfer failed");
        emit Redeemed(msg.sender, stableAmount, collateralAfterFee, true);
    }

    // redeem to token (ERC20)
    function redeemToToken(uint256 stableAmount) external nonReentrant {
        require(address(acceptedToken) != address(0), "no token configured");
        require(stableAmount > 0, "zero");
        stable.transferFrom(msg.sender, address(this), stableAmount);
        stable.burn(address(this), stableAmount);

        uint256 price = getNormalizedPrice();
        uint256 tokenAmount = (stableAmount * 1e18) / price; // assumes token decimals = 18
        uint256 tokenAfterFee = (tokenAmount * (BPS - feeBps)) / BPS;
        require(acceptedToken.balanceOf(address(this)) >= tokenAfterFee, "insufficient token reserves");
        acceptedToken.safeTransfer(msg.sender, tokenAfterFee);
        emit Redeemed(msg.sender, stableAmount, tokenAfterFee, false);
    }

    // owner functions to add/remove reserves (ETH or token)
    receive() external payable {}
    function withdrawETH(address to, uint256 amount) external onlyOwner {
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "send failed");
    }
    function withdrawToken(address to, uint256 amount) external onlyOwner {
        require(address(acceptedToken) != address(0), "no token configured");
        acceptedToken.safeTransfer(to, amount);
    }

    function setFeeBps(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "fee too big"); // max 10%
        feeBps = newFee;
    }
}
