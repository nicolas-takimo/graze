import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Importa os tipos
import {
  StableToken,
  AgroAsset,
  VaultManager,
  AuctionManager,
  MockV3Aggregator,
} from "../typechain-types";

describe("Fluxo Completo do Sistema", function () {
  // Variáveis globais
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carlos: HardhatEthersSigner;

  let stableToken: StableToken;
  let agroAsset: AgroAsset;
  let vaultManager: VaultManager;
  let auctionManager: AuctionManager;
  let mockPriceFeed: MockV3Aggregator;

  // Preços e valores
  const ethPrice = 2000_00000000; // $2000 (com 8 decimais)
  const oneEther = ethers.parseEther("1.0");
  const aUSD_100 = ethers.parseEther("100");
  const aUSD_500 = ethers.parseEther("500");
  const aUSD_1000 = ethers.parseEther("1000");

  /**
   * Configuração: Roda antes de CADA teste 'it()'
   */
  beforeEach(async function () {
    [alice, bob, carlos] = await ethers.getSigners();

    // 1. Deploy do Mock Price Feed
    const MockAggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
    mockPriceFeed = await MockAggregatorFactory.connect(alice).deploy(8, ethPrice);

    // 2. Deploy dos Tokens
    const StableTokenFactory = await ethers.getContractFactory("StableToken");
    stableToken = await StableTokenFactory.connect(alice).deploy();

    const AgroAssetFactory = await ethers.getContractFactory("AgroAsset");
    agroAsset = await AgroAssetFactory.connect(alice).deploy();

    // 3. Deploy do VaultManager
    const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManagerFactory.connect(alice).deploy(
      await mockPriceFeed.getAddress(),
      await stableToken.getAddress(),
    );

    // 4. Deploy do AuctionManager
    const AuctionManagerFactory = await ethers.getContractFactory("AuctionManager");
    auctionManager = await AuctionManagerFactory.connect(alice).deploy();

    // 5. Permissão para o VaultManager mintar StableToken
    await stableToken.connect(alice).transferOwnership(await vaultManager.getAddress());
  });


  // =================================================================
  // Testes do VaultManager (Casos Críticos)
  // =================================================================
  describe("VaultManager: Casos Críticos (Lógica 150%/110%)", function () {
    
    it("Deveria permitir mintar a 150% e falhar abaixo disso", async function () {
      // Bob deposita 1 ETH ($2000)
      // O máximo que ele pode mintar a 150% é $1333.33
      // $2000 / 1.50 = 1333.33
      const maxDebt = ethers.parseEther("1333.33");
      const overDebt = ethers.parseEther("1334");

      // Ação 1: Mintar no limite de 150% (DEVE FUNCIONAR)
      await expect(
        vaultManager.connect(bob).depositAndMint(maxDebt, { value: oneEther })
      ).to.not.be.reverted;

      // Ação 2: Tentar mintar acima do limite (DEVE FALHAR)
      // (Usamos um novo cofre para este teste)
      await expect(
        vaultManager.connect(carlos).depositAndMint(overDebt, { value: oneEther })
      ).to.be.revertedWith("Vault health too low after mint");
    });

    it("Deveria falhar ao retirar colateral que quebre a razão de 150%", async function () {
      // Bob deposita 1 ETH ($2000) e minta 1000 aUSD (200%)
      await vaultManager.connect(bob).depositAndMint(aUSD_1000, { value: oneEther });

      // O mínimo para sacar é 150%.
      // $1000 (dívida) * 150% = $1500.
      // Bob só pode retirar $500 de ETH (0.25 ETH).
      
      // Ação: Bob tenta retirar 0.3 ETH (deixando $1400 de colateral)
      // Isso é 140%, abaixo dos 150%. DEVE falhar.
      await expect(
        vaultManager.connect(bob).repayAndWithdraw(0, ethers.parseEther("0.3"))
      ).to.be.revertedWith("Vault health too low after withdraw");

      // Ação 2: Bob tenta retirar 0.1 ETH (deixando $1800 de colateral)
      // Isso é 180%. DEVE funcionar.
      await expect(
        vaultManager.connect(bob).repayAndWithdraw(0, ethers.parseEther("0.1"))
      ).to.not.be.reverted;
    });

    it("Deveria PERMITIR LIQUIDAÇÃO se o preço do ETH cair abaixo de 110%", async function () {
      // --- Setup ---
      await vaultManager.connect(carlos).depositAndMint(aUSD_1000, { value: oneEther });
      await vaultManager.connect(bob).depositAndMint(aUSD_1000, { value: oneEther });

      // --- Ação: Preço do ETH CAI (para $1100) ---
      // (Limite é 110%, então $1100/$1000 = 110% é o ponto exato de liquidação)
      await mockPriceFeed.setLatestAnswer(1100_00000000); // Preço $1100
      
      const precision = ethers.parseEther("1.0");
      expect(await vaultManager.getHealthFactor(bob.address)).to.be.lte(precision);

      // --- Ação: Liquidação ---
      await stableToken.connect(carlos).approve(await vaultManager.getAddress(), aUSD_1000);
      const tx = vaultManager.connect(carlos).liquidate(bob.address);
      
      // --- Verificações ---
      const expectedStablePaid = aUSD_1000;
      
      const collateralToSeizeUSD = ethers.parseEther("1050"); // $1050 (1e18)
      const normalizedPrice = ethers.parseEther("1100"); // $1100 (1e18)

      // A fórmula do Solidity: (USD_Value * 1e18) / (USD/ETH Price)
      const expectedEthSeized = (collateralToSeizeUSD * precision) / normalizedPrice;

      // Verificação de sanidade 
      expect(expectedEthSeized).to.equal(ethers.toBigInt("954545454545454545"));


      await expect(tx)
        .to.emit(vaultManager, "VaultLiquidated")
        .withArgs(carlos.address, bob.address, expectedStablePaid, expectedEthSeized);

      const vault = await vaultManager.vaults(bob.address);
      expect(vault.stableDebt).to.equal(0);
      expect(vault.ethCollateral).to.equal(oneEther - expectedEthSeized);
    });

  });

  // =================================================================
  // Testes do AuctionManager (Casos Críticos)
  // =================================================================
  describe("AuctionManager: Casos Críticos", function () {
    const tokenId = 0;
    
    beforeEach(async function () {
      await agroAsset.connect(alice).mint(alice.address, "Soja", 100, "Local");
      await agroAsset.connect(alice).approve(await auctionManager.getAddress(), tokenId);
      const biddingEnds = (await time.latest()) + 3600;
      await auctionManager.connect(alice).createAuction(
        await agroAsset.getAddress(),
        tokenId,
        await stableToken.getAddress(),
        biddingEnds,
        false, 
        0
      );
    });

    it("Deveria gerenciar múltiplos lances e reembolsar o perdedor (Regressão)", async function () {
      // Setup
      await vaultManager.connect(bob).depositAndMint(aUSD_500, { value: oneEther });
      await vaultManager.connect(carlos).depositAndMint(aUSD_500, { value: oneEther });
      // Lances
      await stableToken.connect(bob).approve(await auctionManager.getAddress(), aUSD_100);
      await auctionManager.connect(bob).placeBid(0, aUSD_100);
      await stableToken.connect(carlos).approve(await auctionManager.getAddress(), aUSD_500);
      await auctionManager.connect(carlos).placeBid(0, aUSD_500);
      // Finalização
      await time.increase(3601);
      await auctionManager.connect(alice).finalizeWithProof(0, carlos.address, aUSD_500, "0x");
      // Reembolso
      await auctionManager.refundLosers(0);
      // Verificações
      expect(await agroAsset.ownerOf(tokenId)).to.equal(carlos.address);
      expect(await stableToken.balanceOf(alice.address)).to.equal(aUSD_500);
      expect(await stableToken.balanceOf(bob.address)).to.equal(aUSD_500);
      expect(await stableToken.balanceOf(await auctionManager.getAddress())).to.equal(0);
    });

    it("DEVERIA PERMITIR CANCELAR se o leilão terminar sem lances (CASO CRÍTICO)", async function () {
      // Avança o tempo
      await time.increase(3601);
      // Checa falhas
      await expect(auctionManager.connect(bob).cancelAuction(0)).to.be.revertedWith("Not seller");
      await expect(auctionManager.connect(alice).finalizeWithProof(0, bob.address, 1, "0x")).to.be.revertedWith("No bids placed");
      // Cancela
      await auctionManager.connect(alice).cancelAuction(0);
      // Verifica
      expect(await agroAsset.ownerOf(tokenId)).to.equal(alice.address);
    });

    it("DEVERIA FALHAR AO CANCELAR se houver lances (CASO CRÍTICO)", async function () {
      // Setup
      await vaultManager.connect(bob).depositAndMint(aUSD_100, { value: oneEther });
      await stableToken.connect(bob).approve(await auctionManager.getAddress(), aUSD_100);
      await auctionManager.connect(bob).placeBid(0, aUSD_100);
      // Avança o tempo
      await time.increase(3601);
      // Tenta cancelar (falha)
      await expect(auctionManager.connect(alice).cancelAuction(0)).to.be.revertedWith("Auction has bids");
    });
  });
});