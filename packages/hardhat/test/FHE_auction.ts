import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// --- FHE Imports ---
import { FhevmInstance, createInstance } from "fhevmjs";

import { WStableToken, WAgroAsset, AuctionManagerFHE } from "../typechain-types";

// Helper para criptografar
async function encryptBid(amount: number, fhevm: FhevmInstance) {
  // O 'fhevm' injetado pelo Hardhat tem o 'encrypt32'
  return fhevm.encrypt32(amount);
}

describe("FHE Auction System (Zama Logic)", function () {
  let alice: HardhatEthersSigner; // Vendedora
  let bob: HardhatEthersSigner; // Comprador 1 (Perdedor)
  let carlos: HardhatEthersSigner; // Comprador 2 (Vencedor)
  let treasury: HardhatEthersSigner; // Tesouraria

  let wStableToken: WStableToken;
  let wAgroAsset: WAgroAsset;
  let auctionManager: AuctionManagerFHE;

  let fhevm: FhevmInstance;

  const oneEther = ethers.parseEther("1.0");
  const aUSD_100 = ethers.parseEther("100");
  const aUSD_500 = ethers.parseEther("500");

  beforeEach(async function () {
    [alice, bob, carlos, treasury] = await ethers.getSigners();

    // 1. Deploy Contratos da Rede Zama (Mocks)
    const WStableTokenFactory = await ethers.getContractFactory("WStableToken");
    wStableToken = await WStableTokenFactory.connect(alice).deploy();

    const WAgroAssetFactory = await ethers.getContractFactory("WAgroAsset");
    wAgroAsset = await WAgroAssetFactory.connect(alice).deploy();

    // 2. Deploy FHE AuctionManager
    const AuctionManagerFactory = await ethers.getContractFactory("AuctionManagerFHE");
    auctionManager = await AuctionManagerFactory.connect(alice).deploy(
      treasury.address,
      250, // 2.5% fee
    );

    // 3. FHE Setup
    const fhevmImport = await import("fhevmjs");
    const FhevmInstance = fhevmImport.FhevmInstance;
    const createInstance = fhevmImport.createInstance;

    const ret = await ethers.provider.call({
      to: "0x00000000000000000000000000000000000000F0",
      data: "0x4edff33c",
    });
    const publicKey = ethers.hexlify(ret);

    fhevm = await createInstance({
      chainId: (await ethers.provider.getNetwork()).chainId,
      publicKey,
    });
  });

  it("Should run a full FHE auction, find winner privately, pay fee, and refund losers", async function () {
    const tokenId = 0;

    // --- Setup ---
    // 1. Alice (vendedora) "recebe" seu WAgroAsset da ponte
    // (No teste, ela mesma minta)
    await wAgroAsset.connect(alice).mint(alice.address, tokenId, "Soja", 100, "Local");

    // 2. Alice cria o leilão
    await wAgroAsset.connect(alice).approve(await auctionManager.getAddress(), tokenId);
    const biddingEnds = (await time.latest()) + 3600;
    await auctionManager.connect(alice).createAuction(
      await wAgroAsset.getAddress(),
      tokenId,
      await wStableToken.getAddress(),
      biddingEnds,
      100, // minDeposit (plaintext)
    );

    // 3. Bob e Carlos "recebem" seu WStableToken da ponte
    await wStableToken.connect(alice).mint(bob.address, aUSD_500);
    await wStableToken.connect(alice).mint(carlos.address, aUSD_500);

    // --- Bidding (Encrypted) ---
    // 4. Bob (perdedor) faz lance de 100
    const bobBidAmount = 100;
    const bobDeposit = aUSD_100;
    const encryptedBobBid = await encryptBid(bobBidAmount, fhevm);
    await wStableToken.connect(bob).approve(await auctionManager.getAddress(), bobDeposit);
    await auctionManager.connect(bob).submitEncryptedBid(0, encryptedBobBid, bobDeposit);

    // 5. Carlos (vencedor) faz lance de 200
    const carlosBidAmount = 200;
    const carlosDeposit = ethers.parseEther("200");
    const encryptedCarlosBid = await encryptBid(carlosBidAmount, fhevm);
    await wStableToken.connect(carlos).approve(await auctionManager.getAddress(), carlosDeposit);
    await auctionManager.connect(carlos).submitEncryptedBid(0, encryptedCarlosBid, carlosDeposit);

    // --- Finalization (Public) ---
    await time.increase(3601);
    await auctionManager.connect(alice).finalizeAuction(0);

    // --- Verifications ---
    const winningAmount = ethers.parseEther("200");
    const feeBps = 250n;
    const expectedFee = (winningAmount * feeBps) / 10000n; // 5 aUSD
    const expectedSellerProceeds = winningAmount - expectedFee; // 195 aUSD

    // 1. Carlos (vencedor) tem o NFT
    expect(await wAgroAsset.ownerOf(tokenId)).to.equal(carlos.address);
    // 2. Alice (vendedora) recebeu o valor líquido
    expect(await wStableToken.balanceOf(alice.address)).to.equal(expectedSellerProceeds);
    // 3. Treasury (tesouraria) recebeu a taxa
    expect(await wStableToken.balanceOf(treasury.address)).to.equal(expectedFee);
    // 4. Dinheiro de Bob (perdedor) está preso
    expect(await wStableToken.balanceOf(await auctionManager.getAddress())).to.equal(aUSD_100);

    // --- Refund ---
    await auctionManager.connect(alice).refundLosers(0);

    // 5. Contrato está vazio
    expect(await wStableToken.balanceOf(await auctionManager.getAddress())).to.equal(0);
    // 6. Bob (perdedor) foi reembolsado
    expect(await wStableToken.balanceOf(bob.address)).to.equal(aUSD_500);
    // 7. Carlos (vencedor) gastou seus 200
    expect(await wStableToken.balanceOf(carlos.address)).to.equal(ethers.parseEther("300"));
  });
});
