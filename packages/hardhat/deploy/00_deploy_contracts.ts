import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { StableToken } from "../typechain-types";

/**
 * Este script de deploy é ciente da rede.
 * 1. 'yarn deploy --network baseSepolia' -> Implanta os contratos da Base (Vault, Ativos Reais, Ponte)
 * 2. 'yarn deploy --network zama'       -> Implanta os contratos do Zama (Leilão FHE, Ativos Embrulhados)
 */
const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const { network } = hre;

  const deployerSigner = await hre.ethers.getSigner(deployer);
  console.log(⁠ 🏃 Starting deploy on ${network.name} with account: ⁠, deployer);

  // =================================================================
  // --- DEPLOY NA BASE SEPOLIA OU LOCALHOST (Ativos Reais, Vault, Ponte) ---
  // =================================================================
  if (network.name === "baseSepolia" || network.name === "localhost" || network.name === "hardhat") {
    console.log("🔥 Deploying to Base Sepolia...");

    // 1. StableToken
    const stableTokenDeployment = await deploy("StableToken", { from: deployer, args: [], log: true });
    console.log("✅ StableToken (aUSD) deployed to:", stableTokenDeployment.address);
    const stableToken: StableToken = await hre.ethers.getContractAt(
      "StableToken",
      stableTokenDeployment.address,
      deployerSigner,
    );

    // 2. AgroAsset
    const agroAssetDeployment = await deploy("AgroAsset", { from: deployer, args: [], log: true });
    console.log("✅ AgroAsset (AGRO) deployed to:", agroAssetDeployment.address);

    // 3. VaultManager 
    const priceFeedAddress = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1; //Endereço priceFeed Chainlink
    console.log(⁠ ℹ️ Using Chainlink Price Feed: ${priceFeedAddress} ⁠);

    const vaultManagerDeployment = await deploy("VaultManager", {
      from: deployer,
      args: [priceFeedAddress, stableTokenDeployment.address],
      log: true,
    });
    console.log("✅ VaultManager deployed to:", vaultManagerDeployment.address);

    // 4. AuctionManager
    const initialFeeRecipient = deployer;
    const initialFeeBps = 250; // 2.5%

    const auctionManagerDeployment = await deploy("AuctionManager", {
      from: deployer,
      args: [initialFeeRecipient, initialFeeBps],
      log: true,
    });
    console.log("✅ AuctionManager deployed to:", auctionManagerDeployment.address);

    // 5. MockBridgeBase
    await deploy("MockBridgeBase", {
      from: deployer,
      args: [stableTokenDeployment.address, agroAssetDeployment.address],
      log: true,
    });
    console.log("✅ MockBridgeBase deployed.");

    // 6. Transferir propriedade do StableToken
    console.log("Verificando posse do StableToken...");
    const vaultManagerAddress = vaultManagerDeployment.address;
    const currentOwner = await stableToken.owner();

    if (currentOwner.toLowerCase() === deployer.toLowerCase()) {
      // 1. Se o dono ainda for o deployer, transfere.
      console.log(⁠ Transferring StableToken ownership to VaultManager (${vaultManagerAddress})... ⁠);
      const tx = await stableToken.transferOwnership(vaultManagerAddress);
      await tx.wait();
      console.log("🎉 StableToken ownership transferred to VaultManager!");
    } else if (currentOwner.toLowerCase() === vaultManagerAddress.toLowerCase()) {
      // 2. Se o VaultManager CORRETO JÁ É o dono, apenas avisa e pula.
      console.log("✅ StableToken ownership is already correct (VaultManager).");
    } else {
      // 3. Se for um dono desconhecido (acontece se o VaultManager for reimplantado)
      console.warn(
        ⁠ 🚨 StableToken is owned by an unknown address (${currentOwner}). Não é possível transferir a posse. ⁠,
      );
    }

    // =================================================================
    // --- DEPLOY NO ZAMA (Leilão FHE, Ativos Embrulhados) ---
    // =================================================================
  } else if (network.name === "zama") {
    console.log("🔒 Deploying to Zama Devnet...");

    // 1. WStableToken (waUSD)
    const wStableTokenDeployment = await deploy("WStableToken", { from: deployer, args: [], log: true });
    console.log("✅ WStableToken (waUSD) deployed to:", wStableTokenDeployment.address);

    // 2. WAgroAsset (wAGRO)
    const wAgroAssetDeployment = await deploy("WAgroAsset", { from: deployer, args: [], log: true });
    console.log("✅ WAgroAsset (wAGRO) deployed to:", wAgroAssetDeployment.address);

    // 3. AuctionManagerFHE
    const initialFeeRecipient = deployer; // O admin recebe as taxas
    const initialFeeBps = 250; // 2.5%

    await deploy("AuctionManagerFHE", {
      from: deployer,
      args: [initialFeeRecipient, initialFeeBps],
      log: true,
    });
    console.log("✅ AuctionManagerFHE deployed.");

    // (Opcional: transferir propriedade do waUSD/wAGRO para a "ponte"
    // mas para um hackathon, o deployer ser o 'owner' de tudo é mais fácil)
    console.log("🎉 Zama contracts deployed! Admin (deployer) is the owner of wrapped tokens.");
  } else {
    console.warn(⁠ 🚨 No deploy script configured for network: ${network.name}. Skipping... ⁠);
  }
};

export default deployContracts;
deployContracts.tags = ["All"];