import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);

  // ===== CONFIG - use lowercase address to avoid checksum issues =====
  // Chainlink ETH/USD feed (Base Sepolia) - lowercase to avoid checksum validation error
  const CHAINLINK_ETH_USD_FEED = "0x2f62b8e830afcf88bf0e73c21d1397ef93da7f2e";

  // ===== 1) StableToken =====
  const StableTokenFactory = await ethers.getContractFactory("StableToken");
  const stable = await StableTokenFactory.deploy();
  await stable.waitForDeployment();
  const stableAddr = await stable.getAddress();
  console.log("✅ StableToken deployed at:", stableAddr);

  // ===== 2) StableSwap =====
  // constructor(address _priceFeed, address _acceptedToken, bool _acceptNativeETH, address stableAddr)
  const StableSwapFactory = await ethers.getContractFactory("StableSwap");
  const swap = await StableSwapFactory.deploy(
    CHAINLINK_ETH_USD_FEED, // price feed
    ethers.ZeroAddress, // acceptedToken = address(0) => native ETH
    true, // acceptNativeETH
    stableAddr, // stable token address
  );
  await swap.waitForDeployment();
  const swapAddr = await swap.getAddress();
  console.log("✅ StableSwap deployed at:", swapAddr);

  // Transfer ownership of StableToken -> StableSwap so it can mint/burn
  try {
    const tx = await stable.transferOwnership(swapAddr);
    await tx.wait();
    console.log("🔑 StableToken ownership transferred to StableSwap");
  } catch (err) {
    console.warn("⚠️ transferOwnership failed (check StableToken implementation):", err);
  }

  // ===== 3) AgroAsset (NFT) =====
  const AgroAssetFactory = await ethers.getContractFactory("AgroAsset");
  const nft = await AgroAssetFactory.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("✅ AgroAsset deployed at:", nftAddr);

  // ===== 4) AuctionManager =====
  const AuctionFactory = await ethers.getContractFactory("AuctionManager");
  const auction = await AuctionFactory.deploy();
  await auction.waitForDeployment();
  const auctionAddr = await auction.getAddress();
  console.log("✅ AuctionManager deployed at:", auctionAddr);

  // ===== Summary =====
  console.log("\n🎯 DEPLOY SUMMARY");
  console.log("-------------------------");
  console.log("StableToken :", stableAddr);
  console.log("StableSwap  :", swapAddr);
  console.log("AgroAsset   :", nftAddr);
  console.log("AuctionMgr  :", auctionAddr);
  console.log("-------------------------\n");
  console.log("✅ Deployment complete!");
}

main().catch(error => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
