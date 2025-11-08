import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// --- FHE Imports ---
import { FhevmInstance, createInstance } from "fhevmjs"; 

import {
    WStableToken,
    WAgroAsset,
    AuctionManagerFHE,
} from "../typechain-types";

async function decryptAndGenerateProof(
    auctionId: number,
    auctionManager: AuctionManagerFHE,
    fhevm: FhevmInstance
) {
    const auction = await auctionManager.auctions(auctionId);
    
    // 1. Pega os "handles" criptografados que o contrato armazenou
    const highestBidHandle = auction.highestBid;
    const winnerIndexHandle = auction.winnerIndex;

    // 2. Descriptografa eles (só o fhevmjs pode fazer isso no teste)
    const winningAmount = fhevm.decrypt(highestBidHandle);
    const winnerIndex = fhevm.decrypt(winnerIndexHandle);

    // 3. Prepara os dados para o callback
    const handles = [highestBidHandle, winnerIndexHandle];
    const decrypted = [winningAmount, winnerIndex];
    const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        decrypted
    );
    
    // 4. Gera a prova de descriptografia (como se o KMS fizesse)
    const proof = await fhevm.getSignature(handles, decrypted);

    return {
        encodedData,
        proof,
    };
}


describe("FHE Auction System (Zama Logic - API NOVA)", function () {
    let alice: HardhatEthersSigner; 
    let bob: HardhatEthersSigner;
    let carlos: HardhatEthersSigner;
    let treasury: HardhatEthersSigner;

    let wStableToken: WStableToken;
    let wAgroAsset: WAgroAsset;
    let auctionManager: AuctionManagerFHE;

    let fhevm: FhevmInstance;

    const aUSD_100 = ethers.parseEther("100");
    const aUSD_500 = ethers.parseEther("500");

    beforeEach(async function () {
        [alice, bob, carlos, treasury] = await ethers.getSigners();

        const WStableTokenFactory = await ethers.getContractFactory("WStableToken");
        wStableToken = await WStableTokenFactory.connect(alice).deploy();

        const WAgroAssetFactory = await ethers.getContractFactory("WAgroAsset");
        wAgroAsset = await WAgroAssetFactory.connect(alice).deploy();

        const AuctionManagerFactory = await ethers.getContractFactory("AuctionManagerFHE");
        auctionManager = await AuctionManagerFactory.connect(alice).deploy(
            treasury.address,
            250 // 2.5% fee
        );
        
        const fhevmImport = await import("fhevmjs");
        const createInstance = fhevmImport.createInstance;
        
        const ret = await ethers.provider.call({
            to: "0x00000000000000000000000000000000000000F0",
            data: "0x4edff33c",
        });
        const publicKey = ethers.hexlify(ret);
        
        fhevm = await createInstance({ 
            chainId: (await ethers.provider.getNetwork()).chainId, 
            publicKey 
        });
    });


    it("Should run a full FHE auction, find winner, request decryption, fulfill, and refund", async function () {
        const tokenId = 0;
        
        // --- Setup ---
        await wAgroAsset.connect(alice).mint(alice.address, tokenId, "Soja", 100, "Local");
        await wAgroAsset.connect(alice).approve(await auctionManager.getAddress(), tokenId);
        
        const biddingEnds = (await time.latest()) + 3600;
        await auctionManager.connect(alice).createAuction(
            await wAgroAsset.getAddress(),
            tokenId,
            await wStableToken.getAddress(),
            biddingEnds,
            100 // minDeposit (plaintext)
        );
        
        await wStableToken.connect(alice).mint(bob.address, aUSD_500);
        await wStableToken.connect(alice).mint(carlos.address, aUSD_500);

        // --- Bidding (Encrypted) - CORRIGIDO ---
        
        // 4. Bob (perdedor) faz lance de 100
        const bobBidAmount = 100;
        const bobDeposit = aUSD_100;
        const bobInput = await fhevm.getEncryptedInput(
            await auctionManager.getAddress(),
            auctionManager.interface.getFunction("submitEncryptedBid").selector
        );
        const encryptedBobBid = bobInput.encrypt32(bobBidAmount);
        await wStableToken.connect(bob).approve(await auctionManager.getAddress(), bobDeposit);
        await auctionManager.connect(bob).submitEncryptedBid(
            0,
            encryptedBobBid.handle,
            encryptedBobBid.proof,
            bobDeposit
        );

        // 5. Carlos (vencedor) faz lance de 200
        const carlosBidAmount = 200;
        const carlosDeposit = ethers.parseEther("200");
        const carlosInput = await fhevm.getEncryptedInput(
            await auctionManager.getAddress(),
            auctionManager.interface.getFunction("submitEncryptedBid").selector
        );
        const encryptedCarlosBid = carlosInput.encrypt32(carlosBidAmount);
        await wStableToken.connect(carlos).approve(await auctionManager.getAddress(), carlosDeposit);
        await auctionManager.connect(carlos).submitEncryptedBid(
            0,
            encryptedCarlosBid.handle,
            encryptedCarlosBid.proof,
            carlosDeposit
        );

        // --- Finalization (Parte 1: Requisição) ---
        await time.increase(3601);
        
        // Esta chamada NÃO descriptografa, ela apenas emite o evento DecryptionRequested
        await auctionManager.connect(alice).finalizeAuction(0);
        expect((await auctionManager.auctions(0)).status).to.equal(1); // 1 = AwaitingDecryption

        // --- Finalization (Parte 2: Simulação do Relayer) ---
        
        // O teste agora descriptografa os valores e gera a prova
        const { encodedData, proof } = await decryptAndGenerateProof(0, auctionManager, fhevm);

        // O teste chama o fulfillAuction com os dados descriptografados
        // (Qualquer um pode chamar, mas em produção seria um relayer)
        await auctionManager.connect(alice).fulfillAuction(0, encodedData, proof.signature);

        // --- Verifications ---
        const winningAmount = ethers.parseEther("200");
        const feeBps = 250n;
        const expectedFee = (winningAmount * feeBps) / 10000n; // 5 aUSD
        const expectedSellerProceeds = winningAmount - expectedFee; // 195 aUSD

        expect((await auctionManager.auctions(0)).status).to.equal(2); // 2 = Closed
        expect(await wAgroAsset.ownerOf(tokenId)).to.equal(carlos.address);
        expect(await wStableToken.balanceOf(alice.address)).to.equal(expectedSellerProceeds);
        expect(await wStableToken.balanceOf(treasury.address)).to.equal(expectedFee);
        
        // Depósito do Bob (100) ainda está lá. Depósito de Carlos foi usado.
        expect(await wStableToken.balanceOf(await auctionManager.getAddress())).to.equal(aUSD_100);
        
        // --- Refund ---
        await auctionManager.connect(alice).refundLosers(0);
        
        expect(await wStableToken.balanceOf(await auctionManager.getAddress())).to.equal(0);
        expect(await wStableToken.balanceOf(bob.address)).to.equal(aUSD_500);
        expect(await wStableToken.balanceOf(carlos.address)).to.equal(ethers.parseEther("300"));
    });
});