const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("✅ Signer:", signer.address);
  
  const agroAsset = await hre.ethers.getContractAt("AgroAsset", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
  console.log("✅ Contrato AgroAsset conectado");
  
  console.log("🔄 Mintando NFT...");
  const tx = await agroAsset.mint(
    signer.address,
    "Gado Nelore",
    1000,
    "Mato Grosso"
  );
  
  console.log("📝 TX Hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ NFT mintado com sucesso!");
  console.log("⛽ Gas usado:", receipt.gasUsed.toString());
  
  const nextId = await agroAsset.nextTokenId();
  console.log("🎯 Próximo Token ID:", nextId.toString());
  
  // Verificar o asset info
  const tokenId = nextId - 1n;
  const assetInfo = await agroAsset.assetInfo(tokenId);
  console.log("\n📋 Info do Asset:");
  console.log("  - Tipo:", assetInfo[0]);
  console.log("  - Quantidade:", assetInfo[1].toString());
  console.log("  - Localização:", assetInfo[2]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
