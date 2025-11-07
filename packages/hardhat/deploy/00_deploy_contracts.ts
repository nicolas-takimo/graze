import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { StableToken } from "../typechain-types"; // Importa o tipo

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const { network } = hre;

  // Converte a string 'deployer' para um objeto 'Signer'
  const deployerSigner = await hre.ethers.getSigner(deployer);

  console.log(`🏃Iniciando deploy na rede ${network.name} com a conta:`, deployer);

  // 1. Deploy StableToken (aUSD)
  const stableTokenDeployment = await deploy("StableToken", {
    from: deployer,
    args: [],
    log: true,
  });
  
  // Anexa o ABI do 'StableToken' e o Signer ao endereço deployado
  const stableToken: StableToken = await hre.ethers.getContractAt(
    "StableToken",
    stableTokenDeployment.address,
    deployerSigner
  );
  console.log("✅ StableToken (aUSD) deployado em:", await stableToken.getAddress());

  // 2. Deploy AgroAsset (AGRO)
  await deploy("AgroAsset", {
    from: deployer,
    args: [],
    log: true,
  });
  console.log("✅ AgroAsset (AGRO) deployado.");

  // 3. Definir Endereço do Price Feed
  // Endereço do Chainlink ETH/USD na Base Sepolia
  const priceFeedAddress = "0x4adc67696ba383f43dd60a9ea083f30304242666";
  
  console.log(`ℹ️ Usando Price Feed (ETH/USD) da Base Sepolia: ${priceFeedAddress}`);

  // 4. Deploy VaultManager
  const vaultManagerArgs = [
    priceFeedAddress,
    await stableToken.getAddress(),
  ];

  const vaultManagerDeployment = await deploy("VaultManager", {
    from: deployer,
    args: vaultManagerArgs,
    log: true,
  });
  const newOwnerAddress = vaultManagerDeployment.address;
  console.log("✅ VaultManager deployado em:", newOwnerAddress);

  // 5. Deploy AuctionManager
  const initialFeeRecipient = deployer; // Ou um endereço de cofre
  const initialFeeBps = 250; // 2.5%

  await deploy("AuctionManager", {
    from: deployer,
    args: [initialFeeRecipient, initialFeeBps], 
    log: true,
  });
  console.log("✅ AuctionManager deployado.");

  // 6. Transferir propriedade do StableToken
  console.log(`Transferindo propriedade do StableToken (${await stableToken.getAddress()}) para o VaultManager (${newOwnerAddress})...`);

  const tx = await stableToken.transferOwnership(newOwnerAddress);
  await tx.wait(); // Espera a transação ser confirmada
  
  console.log("🎉 Propriedade do StableToken transferida!");
};

export default deployContracts;
deployContracts.tags = ["All"];