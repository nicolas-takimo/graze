const hre = require("hardhat");

async function main() {
  const priceFeedAddress = "0x4adc67696ba383f43dd60a9ea083f30304242666";
  const vaultManagerAddress = "0xCCF3dc3aDfB31f22fd24fF3CFEf9711376699240";

  console.log("Testing Chainlink Price Feed on Base Sepolia...\n");

  // Test Price Feed directly
  const priceFeed = await hre.ethers.getContractAt(
    "AggregatorV3Interface",
    priceFeedAddress
  );

  try {
    const roundData = await priceFeed.latestRoundData();
    console.log("✅ Price Feed Response:");
    console.log("  - Round ID:", roundData[0].toString());
    console.log("  - Price:", roundData[1].toString());
    console.log("  - Started At:", roundData[2].toString());
    console.log("  - Updated At:", roundData[3].toString());
    console.log("  - Answered In Round:", roundData[4].toString());

    const decimals = await priceFeed.decimals();
    console.log("  - Decimals:", decimals);

    const price = Number(roundData[1]) / Math.pow(10, decimals);
    console.log(`  - ETH/USD Price: $${price.toFixed(2)}\n`);
  } catch (error) {
    console.error("❌ Error calling Price Feed:", error.message);
  }

  // Test VaultManager
  const vaultManager = await hre.ethers.getContractAt(
    "VaultManager",
    vaultManagerAddress
  );

  try {
    const normalizedPrice = await vaultManager.getNormalizedPrice();
    console.log("✅ VaultManager getNormalizedPrice():");
    console.log("  - Normalized Price (18 decimals):", normalizedPrice.toString());
    const priceInUSD = Number(normalizedPrice) / 1e18;
    console.log(`  - ETH/USD Price: $${priceInUSD.toFixed(2)}`);
  } catch (error) {
    console.error("❌ Error calling VaultManager:", error.message);
    console.error("   Full error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
