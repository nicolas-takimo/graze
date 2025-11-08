import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Importa os tipos
import { StableToken, AgroAsset, VaultManager, AuctionManager, MockV3Aggregator } from "../typechain-types";

describe("Fluxo Completo do Sistema", function () {
  // Variáveis globais
  let alice: HardhatEthersSigner; // Vendedora / Deployer
  let bob: HardhatEthersSigner; // Comprador 1 (Perdedor)
  let carlos: HardhatEthersSigner; // Comprador 2 (Vencedor)
  let treasury: HardhatEthersSigner; // Tesouraria (Recebe Taxas)

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
    [alice, bob, carlos, treasury] = await ethers.getSigners();

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

    // 4. Deploy do AuctionManager (COM NOVOS ARGUMENTOS)
    const initialFeeRecipient = treasury.address;
    const initialFeeBps = 250; // 2.5% de taxa para o teste
    const AuctionManagerFactory = await ethers.getContractFactory("AuctionManager");
    auctionManager = await AuctionManagerFactory.connect(alice).deploy(initialFeeRecipient, initialFeeBps);

    // 5. Permissão para o VaultManager mintar StableToken
    await stableToken.connect(alice).transferOwnership(await vaultManager.getAddress());
  });

  // =================================================================
  // Testes do VaultManager (Lógica 150%/110%)
  // =================================================================
  describe("VaultManager: Casos Críticos (Lógica 150%/110%)", function () {
    it("Deveria permitir mintar a 150% e falhar abaixo disso", async function () {
      // Bob deposita 1 ETH ($2000)
      // O máximo que ele pode mintar a 150% é $1333.33
      const maxDebt = ethers.parseEther("1333.33");
      const overDebt = ethers.parseEther("1334");

      // Ação 1: Mintar no limite de 150% (DEVE FUNCIONAR)
      await expect(vaultManager.connect(bob).depositAndMint(maxDebt, { value: oneEther })).to.not.be.reverted;

      // Ação 2: Tentar mintar acima do limite (DEVE FALHAR)
      await expect(vaultManager.connect(carlos).depositAndMint(overDebt, { value: oneEther })).to.be.revertedWith(
        "Vault health too low after mint",
      );
    });

    it("Deveria falhar ao retirar colateral que quebre a razão de 150%", async function () {
      // Bob deposita 1 ETH ($2000) e minta 1000 aUSD (200%)
      await vaultManager.connect(bob).depositAndMint(aUSD_1000, { value: oneEther });

      // O mínimo para sacar é 150% ($1500 colateral). Ele pode sacar até 0.25 ETH ($500).

      // Ação: Bob tenta retirar 0.3 ETH (DEVE FALHAR)
      await expect(vaultManager.connect(bob).repayAndWithdraw(0, ethers.parseEther("0.3"))).to.be.revertedWith(
        "Vault health too low after withdraw",
      );

      // Ação 2: Bob tenta retirar 0.1 ETH (DEVE FUNCIONAR)
      await expect(vaultManager.connect(bob).repayAndWithdraw(0, ethers.parseEther("0.1"))).to.not.be.reverted;
    });

    it("DeverIA PERMITIR LIQUIDAÇÃO se o preço do ETH cair abaixo de 110%", async function () {
      // --- Setup ---
      await vaultManager.connect(carlos).depositAndMint(aUSD_1000, { value: oneEther });
      await vaultManager.connect(bob).depositAndMint(aUSD_1000, { value: oneEther });

      // --- Ação: Preço do ETH CAI (para $1100) ---
      // Razão de Bob: 110%. HF = 1.0. Liquidável.
      await mockPriceFeed.setLatestAnswer(1100_00000000); // Preço $1100
      const precision = ethers.parseEther("1.0");
      expect(await vaultManager.getHealthFactor(bob.address)).to.be.lte(precision);

      // Ação 1: Tentar liquidar antes de $1100 (ex: $1200) (DEVE FALHAR)
      await mockPriceFeed.setLatestAnswer(1200_00000000); // Preço $1200
      await expect(vaultManager.connect(carlos).liquidate(bob.address)).to.be.revertedWith("Vault not liquidatable");

      // --- Ação: Liquidação (Preço $1100) ---
      await mockPriceFeed.setLatestAnswer(1100_00000000); // Preço $1100
      await stableToken.connect(carlos).approve(await vaultManager.getAddress(), aUSD_1000);
      const tx = vaultManager.connect(carlos).liquidate(bob.address);

      // --- Verificações ---
      const expectedStablePaid = aUSD_1000;
      // (1050e18 * 1e18) / 1100e18 = 954545454545454545
      const collateralToSeizeUSD = ethers.parseEther("1050");
      const normalizedPrice = ethers.parseEther("1100");
      const expectedEthSeized = (collateralToSeizeUSD * precision) / normalizedPrice;

      await expect(tx)
        .to.emit(vaultManager, "VaultLiquidated")
        .withArgs(carlos.address, bob.address, expectedStablePaid, expectedEthSeized);

      const vault = await vaultManager.vaults(bob.address);
      expect(vault.stableDebt).to.equal(0);
      expect(vault.ethCollateral).to.equal(oneEther - expectedEthSeized);
    });
  });

  // =================================================================
  // Testes do AuctionManager (Casos Críticos com Taxa)
  // =================================================================
  describe("AuctionManager: Casos Críticos", function () {
    const tokenId = 0;

    // Configura um leilão (ID 0) antes de cada teste
    beforeEach(async function () {
      // Alice (vendedora) minta o NFT 0
      await agroAsset.connect(alice).mint(alice.address, "Soja", 100, "Local");
      await agroAsset.connect(alice).approve(await auctionManager.getAddress(), tokenId);
      const biddingEnds = (await time.latest()) + 3600;
      await auctionManager
        .connect(alice)
        .createAuction(await agroAsset.getAddress(), tokenId, await stableToken.getAddress(), biddingEnds, false, 0);
    });

    it("Deveria gerenciar múltiplos lances, pagar taxa e reembolsar o perdedor", async function () {
      // Setup: Bob e Carlos pegam aUSD
      await vaultManager.connect(bob).depositAndMint(aUSD_500, { value: oneEther });
      await vaultManager.connect(carlos).depositAndMint(aUSD_500, { value: oneEther });

      // Lances
      await stableToken.connect(bob).approve(await auctionManager.getAddress(), aUSD_100);
      await auctionManager.connect(bob).placeBid(0, aUSD_100); // Bob (perdedor) lance 100

      await stableToken.connect(carlos).approve(await auctionManager.getAddress(), aUSD_500);
      await auctionManager.connect(carlos).placeBid(0, aUSD_500); // Carlos (vencedor) lance 500

      // Finalização
      await time.increase(3601);
      // Alice (owner do contrato) finaliza
      await auctionManager.connect(alice).finalizeWithProof(0, carlos.address, aUSD_500, "0x");

      // --- Verificações de Pagamento (COM TAXA) ---
      // O lance vencedor foi 500 aUSD. A taxa é 2.5% (definida no beforeEach principal)
      const feeBps = 250n; // 2.5%
      const winningBid = aUSD_500;
      const expectedFee = (winningBid * feeBps) / 10000n; // 500 * 2.5% = 12.5 aUSD
      const expectedSellerProceeds = winningBid - expectedFee; // 500 - 12.5 = 487.5 aUSD

      // Verificação 1: Carlos (vencedor) tem o NFT
      expect(await agroAsset.ownerOf(tokenId)).to.equal(carlos.address);

      // Verificação 2: Alice (vendedora) recebeu o valor líquido
      expect(await stableToken.balanceOf(alice.address)).to.equal(expectedSellerProceeds);

      // Verificação 3: Treasury (tesouraria) recebeu a taxa
      expect(await stableToken.balanceOf(treasury.address)).to.equal(expectedFee);

      // Verificação 4: Dinheiro de Bob (perdedor) ainda está preso
      expect(await stableToken.balanceOf(await auctionManager.getAddress())).to.equal(aUSD_100);

      // Reembolso
      await auctionManager.refundLosers(0);

      // Verificação 5: Contrato zerado e Bob reembolsado
      expect(await stableToken.balanceOf(await auctionManager.getAddress())).to.equal(0);
      expect(await stableToken.balanceOf(bob.address)).to.equal(aUSD_500); // Bob tem seu $ de volta
    });

    it("DEVERIA PERMITIR CANCELAR se o leilão terminar sem lances", async function () {
      await time.increase(3601); // Avança o tempo

      // Tenta finalizar (falha)
      await expect(auctionManager.connect(alice).finalizeWithProof(0, bob.address, 1, "0x")).to.be.revertedWith(
        "No bids placed",
      );
      // Tenta cancelar como 'bob' (falha)
      await expect(auctionManager.connect(bob).cancelAuction(0)).to.be.revertedWith("Not seller");

      // Cancela como 'alice' (vendedora)
      await auctionManager.connect(alice).cancelAuction(0);

      // Verifica: Alice pegou o NFT de volta
      expect(await agroAsset.ownerOf(tokenId)).to.equal(alice.address);
    });

    it("DEVERIA FALHAR AO CANCELAR se houver lances", async function () {
      // Setup: Bob dá um lance
      await vaultManager.connect(bob).depositAndMint(aUSD_100, { value: oneEther });
      await stableToken.connect(bob).approve(await auctionManager.getAddress(), aUSD_100);
      await auctionManager.connect(bob).placeBid(0, aUSD_100);

      await time.increase(3601);

      // Tenta cancelar (falha)
      await expect(auctionManager.connect(alice).cancelAuction(0)).to.be.revertedWith("Auction has bids");
    });
  });
});
