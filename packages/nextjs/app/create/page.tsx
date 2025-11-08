"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const CreateAsset: NextPage = () => {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();

  // Estados do formulário
  const [step, setStep] = useState<1 | 2>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [nftTokenId, setNftTokenId] = useState<bigint | null>(null);

  // Dados do NFT
  const [assetType, setAssetType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");

  // Dados do Leilão
  const [valorAvaliado, setValorAvaliado] = useState("");
  const [duration, setDuration] = useState("24"); // horas
  const [usesEncrypted, setUsesEncrypted] = useState(false);

  // Calcular lance mínimo (50% do valor avaliado)
  const lanceMinimo = valorAvaliado ? (Number(valorAvaliado) * 0.5).toString() : "0";

  // Endereços dos contratos Base Sepolia
  const agroAssetAddress = "0xAC704c2fA97b332F5CD6b14a3DE8d1b65a06B5e4";
  const stableTokenAddress = "0xd3429C2E46a853Ce99cB27688345FcB41C19B12A";
  const auctionManagerAddress = "0x7058c979CeE214d2F19e560D64cB97f9Ef3ECFfB";

  // Buscar o próximo tokenId disponível
  const { data: nextTokenId, refetch: refetchNextTokenId } = useScaffoldReadContract({
    contractName: "AgroAsset",
    functionName: "nextTokenId",
  });

  // Hooks para escrever nos contratos
  const { writeContractAsync: mintNFT } = useScaffoldWriteContract({ contractName: "AgroAsset" });
  const { writeContractAsync: approveNFT } = useScaffoldWriteContract({ contractName: "AgroAsset" });
  const { writeContractAsync: createAuction } = useScaffoldWriteContract({ contractName: "AuctionManager" });

  // Step 1: Criar NFT
  const handleCreateNFT = async () => {
    if (!assetType || !quantity || !location || !connectedAddress) {
      notification.error("Preencha todos os campos");
      return;
    }

    try {
      setIsCreating(true);

      // Buscar o tokenId que será mintado (antes de mintar)
      await refetchNextTokenId();
      const tokenIdToBeMinted = nextTokenId || 0n;

      // Mint NFT
      await mintNFT({
        functionName: "mint",
        args: [connectedAddress, assetType, BigInt(quantity), location],
      });

      notification.success(`NFT criado com sucesso! Token ID: ${tokenIdToBeMinted.toString()}`);

      // Setar o tokenId que foi mintado
      setNftTokenId(tokenIdToBeMinted);
      setStep(2);
    } catch (error: any) {
      console.error("Erro ao criar NFT:", error);
      notification.error(error.message || "Erro ao criar NFT");
    } finally {
      setIsCreating(false);
    }
  };

  // Step 2: Criar Leilão
  const handleCreateAuction = async () => {
    if (!valorAvaliado || !duration || nftTokenId === null) {
      notification.error("Preencha todos os campos");
      return;
    }

    try {
      setIsCreating(true);

      // 1. Aprovar o AuctionManager a transferir o NFT
      await approveNFT({
        functionName: "approve",
        args: [auctionManagerAddress, nftTokenId],
      });

      notification.info("NFT aprovado. Aguardando confirmação...");

      // Aguardar um pouco para a transação ser confirmada
      await new Promise(resolve => setTimeout(resolve, 3000));

      notification.info("Criando leilão...");

      // 2. Calcular tempo de fim do leilão e lance mínimo (50% do valor avaliado)
      const biddingEnds = BigInt(Math.floor(Date.now() / 1000) + Number(duration) * 3600);
      const minDepositWei = parseEther(lanceMinimo);

      // 3. Criar leilão
      await createAuction({
        functionName: "createAuction",
        args: [agroAssetAddress, nftTokenId, stableTokenAddress, biddingEnds, usesEncrypted, minDepositWei],
      });

      notification.success("Leilão criado com sucesso!");

      // Redirecionar para o dashboard
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao criar leilão:", error);
      notification.error(error.message || "Erro ao criar leilão");
    } finally {
      setIsCreating(false);
    }
  };

  if (!connectedAddress) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 text-center">
        <PlusCircleIcon className="w-16 h-16 mx-auto opacity-30 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Conecte sua Carteira</h2>
        <p className="opacity-70 mb-6">Você precisa conectar sua carteira para criar um ativo</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="btn btn-ghost btn-sm gap-2">
          <ArrowLeftIcon className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>

      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h1 className="text-3xl font-bold mb-2">Criar Novo Ativo</h1>
          <p className="opacity-70 mb-6">Tokenize seu ativo agropecuário e inicie um leilão</p>

          {/* Progress Steps */}
          <ul className="steps steps-horizontal w-full mb-8">
            <li className={`step ${step >= 1 ? "step-primary" : ""}`}>Criar NFT</li>
            <li className={`step ${step >= 2 ? "step-primary" : ""}`}>Configurar Leilão</li>
          </ul>

          {/* Step 1: Criar NFT */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Tipo de Ativo</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={assetType}
                  onChange={e => setAssetType(e.target.value)}
                >
                  <option value="">Selecione o tipo</option>
                  <option value="Gado">Gado</option>
                  <option value="Soja">Soja</option>
                  <option value="Café">Café</option>
                  <option value="Milho">Milho</option>
                  <option value="Terra">Terra</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Quantidade</span>
                </label>
                <input
                  type="number"
                  placeholder="Ex: 100 (cabeças, hectares, toneladas...)"
                  className="input input-bordered w-full"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Localização</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Goiás, Brasil"
                  className="input input-bordered w-full"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={handleCreateNFT}
                disabled={isCreating || !assetType || !quantity || !location}
              >
                {isCreating ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Criando NFT...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Criar NFT
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Configurar Leilão */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="alert alert-success">
                <CheckCircleIcon className="w-6 h-6" />
                <div>
                  <h3 className="font-bold">NFT Criado com Sucesso!</h3>
                  <p className="text-sm">Agora configure os parâmetros do leilão</p>
                </div>
              </div>

              <div className="alert alert-info">
                <div>
                  <h4 className="font-semibold">NFT Token ID: {nftTokenId?.toString()}</h4>
                  <p className="text-sm">Token ID gerado automaticamente pelo contrato</p>
                </div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Valor Avaliado (AUSD)</span>
                  <span className="label-text-alt">Valor estimado do ativo</span>
                </label>
                <div className="input-group">
                  <span className="bg-base-200 px-4 flex items-center">
                    <CurrencyDollarIcon className="w-5 h-5" />
                  </span>
                  <input
                    type="number"
                    placeholder="10000"
                    className="input input-bordered w-full"
                    value={valorAvaliado}
                    onChange={e => setValorAvaliado(e.target.value)}
                  />
                </div>
                {valorAvaliado && (
                  <label className="label">
                    <span className="label-text-alt text-primary font-semibold">
                      Lance mínimo: {lanceMinimo} AUSD (50% do valor avaliado)
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Duração do Leilão</span>
                  <span className="label-text-alt">Em horas</span>
                </label>
                <div className="input-group">
                  <span className="bg-base-200 px-4 flex items-center">
                    <ClockIcon className="w-5 h-5" />
                  </span>
                  <input
                    type="number"
                    placeholder="24"
                    className="input input-bordered w-full"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                  />
                  <span className="bg-base-200 px-4 flex items-center">horas</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={usesEncrypted}
                    onChange={e => setUsesEncrypted(e.target.checked)}
                  />
                  <div>
                    <span className="label-text font-semibold flex items-center gap-2">
                      <LockClosedIcon className="w-4 h-4" />
                      Usar Lances Criptografados (FHE)
                    </span>
                    <span className="label-text-alt block mt-1 opacity-70">
                      Lances privados até o fim do leilão (requer rede Zama)
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-4">
                <button className="btn btn-ghost flex-1" onClick={() => setStep(1)} disabled={isCreating}>
                  Voltar
                </button>
                <button
                  className="btn btn-primary flex-1"
                  onClick={handleCreateAuction}
                  disabled={isCreating || !valorAvaliado || !duration}
                >
                  {isCreating ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Criando Leilão...
                    </>
                  ) : (
                    <>
                      <PlusCircleIcon className="w-5 h-5" />
                      Criar Leilão
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="font-bold">O que é Tokenização?</h3>
            <p className="text-sm opacity-70">
              Seu ativo será representado como um NFT (ERC-721) na blockchain, garantindo propriedade e rastreabilidade.
            </p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="font-bold">Como funciona o Leilão?</h3>
            <p className="text-sm opacity-70">
              Investidores darão lances em AUSD. Ao final, o maior lance vence e o NFT é transferido automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAsset;
