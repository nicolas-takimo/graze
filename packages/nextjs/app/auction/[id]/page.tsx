"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ClockIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const AuctionDetail: NextPage = () => {
  const params = useParams();
  const auctionId = params?.id as string;
  const { address: connectedAddress } = useAccount();
  const [bidAmount, setBidAmount] = useState("");
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Buscar dados do leilão
  const { data: auctionData, isLoading: loadingAuction } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "auctions",
    args: [BigInt(auctionId || 0)],
  });

  // Buscar saldo de USDC
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "StableToken",
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Buscar allowance do USDC
  const { data: allowance } = useScaffoldReadContract({
    contractName: "StableToken",
    functionName: "allowance",
    args: connectedAddress ? [connectedAddress, "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"] : undefined,
  });

  // Buscar metadados do NFT
  const displayAuctionTemp = useMemo(() => {
    if (!auctionData) return null;
    return {
      tokenId: auctionData[2] as bigint,
    };
  }, [auctionData]);

  const { data: assetMetadata } = useScaffoldReadContract({
    contractName: "AgroAsset",
    functionName: "assetInfo",
    args: displayAuctionTemp ? [displayAuctionTemp.tokenId] : undefined,
  });

  // Buscar eventos de lances
  const { data: bidEvents, isLoading: loadingBids } = useScaffoldEventHistory({
    contractName: "AuctionManager",
    eventName: "BidPlaced",
    fromBlock: 0n,
    filters: { id: BigInt(auctionId || 0) },
    watch: true,
  });

  // Filtrar apenas lances da carteira conectada (lances privados)
  const myBids = useMemo(() => {
    if (!bidEvents || !connectedAddress) return [];
    return bidEvents.filter(event => event.args.bidder?.toLowerCase() === connectedAddress.toLowerCase());
  }, [bidEvents, connectedAddress]);

  // Contar apenas meus lances
  const totalBids = myBids.length;

  // Hooks para escrever
  const { writeContractAsync: approveToken } = useScaffoldWriteContract("StableToken");
  const { writeContractAsync: placeBidTx } = useScaffoldWriteContract("AuctionManager");
  const { writeContractAsync: vaultMint } = useScaffoldWriteContract("VaultManager");
  const { writeContractAsync: cancelAuctionTx } = useScaffoldWriteContract("AuctionManager");

  // Processar dados do leilão
  const displayAuction = useMemo(() => {
    if (!auctionData) {
      return {
        seller: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        nftContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        tokenId: 0n,
        paymentToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        biddingEnds: 0n,
        finalized: false,
        encrypted: false,
        minDeposit: 0n,
        winner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        bidCount: 0n,
      };
    }

    // Struct Auction: seller, nftContract, tokenId, stableToken, biddingEnds, finalized, usesEncrypted, minDeposit, winner, bidCount
    const auction = {
      seller: auctionData[0] as `0x${string}`,
      nftContract: auctionData[1] as `0x${string}`,
      tokenId: auctionData[2] as bigint,
      paymentToken: auctionData[3] as `0x${string}`,
      biddingEnds: auctionData[4] as bigint,
      finalized: auctionData[5] as boolean,
      encrypted: auctionData[6] as boolean,
      minDeposit: auctionData[7] as bigint,
      winner: auctionData[8] as `0x${string}`,
      bidCount: auctionData[9] as bigint,
    };

    // Adicionar metadados do asset se disponível
    if (assetMetadata) {
      return {
        ...auction,
        assetType: assetMetadata[0] as string,
        quantity: assetMetadata[1] as bigint,
        location: assetMetadata[2] as string,
      };
    }

    return auction;
  }, [auctionData, assetMetadata]);

  const hasEnded = Number(displayAuction.biddingEnds) < Date.now() / 1000;
  const isActive = !displayAuction.finalized && !hasEnded;
  const needsApproval = allowance ? allowance < parseEther(bidAmount || "0") : true;

  const formatTimeRemaining = (endTime: bigint) => {
    const timeRemaining = Math.max(0, Number(endTime) - Date.now() / 1000);
    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining % 86400) / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleApprove = async () => {
    if (!bidAmount) {
      notification.error("Digite um valor para o lance");
      return;
    }

    try {
      setIsApproving(true);
      await approveToken({
        functionName: "approve",
        args: ["0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9", parseEther("1000000")], // Approve grande valor
      });
      notification.success("Token aprovado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao aprovar:", error);
      notification.error(error.message || "Erro ao aprovar token");
    } finally {
      setIsApproving(false);
    }
  };

  const handleMintTokens = async () => {
    try {
      setIsApproving(true);

      // Depositar 10 ETH como colateral e mintar 10.000 USDC
      // Com ETH a ~$3000, 10 ETH = $30.000 de colateral
      // Mintando 10.000 USDC = ratio de 300% (bem acima do mínimo de 150%)
      await vaultMint({
        functionName: "depositAndMint",
        args: [parseEther("10000")], // Mintar 10.000 USDC
        value: parseEther("10"), // Depositar 10 ETH
      });

      notification.success("✅ 10.000 USDC mintados! Você depositou 10 ETH como colateral.");
    } catch (error: any) {
      console.error("Erro ao mintar:", error);
      const errorMsg = error.message || "Erro ao mintar tokens";
      if (errorMsg.includes("health too low")) {
        notification.error("❌ Colateral insuficiente. Você precisa de mais ETH.");
      } else {
        notification.error(errorMsg);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!bidAmount) {
      notification.error("Digite um valor para o lance");
      return;
    }

    const bidValue = parseEther(bidAmount);

    // Verificar saldo
    const currentBalance = usdcBalance || 0n;
    if (bidValue > currentBalance) {
      notification.error(
        `❌ Saldo insuficiente!\n\nVocê tem: ${formatEther(currentBalance)} USDC\nLance: ${bidAmount} USDC\n\n${
          currentBalance === 0n
            ? "Clique em '💰 Depositar 10 ETH → Obter 10.000 USDC' para obter tokens"
            : "Reduza o valor do lance ou deposite mais ETH no VaultManager"
        }`,
      );
      return;
    }

    try {
      setIsPlacingBid(true);
      await placeBidTx({
        functionName: "placeBid",
        args: [BigInt(auctionId), bidValue],
      });
      notification.success("Lance realizado com sucesso!");
      setBidAmount("");
    } catch (error: any) {
      console.error("Erro ao dar lance:", error);
      notification.error(error.message || "Erro ao dar lance");
    } finally {
      setIsPlacingBid(false);
    }
  };

  if (loadingAuction) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Carregando leilão...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Link href="/" className="btn btn-ghost btn-sm gap-2 mb-6">
        <ArrowLeftIcon className="w-4 h-4" />
        Voltar ao Dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card do Leilão */}
          <div className="card bg-base-100 shadow-md">
            <figure className="h-96 bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center relative">
              <div className="text-9xl">
                {displayAuction.assetType?.toLowerCase().includes("gado") ||
                displayAuction.assetType?.toLowerCase().includes("boi") ||
                displayAuction.assetType?.toLowerCase().includes("vaca")
                  ? "🐄"
                  : displayAuction.assetType?.toLowerCase().includes("soja")
                    ? "🌱"
                    : displayAuction.assetType?.toLowerCase().includes("milho")
                      ? "🌽"
                      : displayAuction.assetType?.toLowerCase().includes("café")
                        ? "☕"
                        : displayAuction.assetType?.toLowerCase().includes("trigo")
                          ? "🌾"
                          : displayAuction.assetType?.toLowerCase().includes("terra") ||
                              displayAuction.assetType?.toLowerCase().includes("fazenda")
                            ? "🏞️"
                            : "🌾"}
              </div>
              {displayAuction.assetType && (
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg">
                  <p className="text-sm font-bold text-gray-800">{displayAuction.assetType}</p>
                </div>
              )}
            </figure>
            <div className="card-body">
              <h2 className="card-title text-3xl">Leilão #{auctionId}</h2>
              <div className="flex gap-2 flex-wrap">
                <span className="badge badge-primary">NFT #{displayAuction.tokenId.toString()}</span>
                {displayAuction.encrypted && <span className="badge badge-secondary">Lances Privados</span>}
                {isActive && !hasEnded ? (
                  <span className="badge badge-success">Ativo</span>
                ) : (
                  <span className="badge badge-error">Encerrado</span>
                )}
              </div>

              {/* Informações do Ativo */}
              {(displayAuction.assetType || displayAuction.quantity || displayAuction.location) && (
                <div className="mt-4 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border-2 border-primary/30">
                  <h3 className="font-bold text-xl mb-4 text-primary">🌾 Sobre o Ativo</h3>
                  <div className="space-y-4">
                    {displayAuction.assetType && (
                      <div className="bg-base-100 p-4 rounded-lg">
                        <p className="text-sm opacity-70 mb-2">Tipo de Ativo</p>
                        <p className="font-bold text-2xl text-primary">{displayAuction.assetType}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {displayAuction.quantity && (
                        <div className="bg-base-100 p-4 rounded-lg">
                          <p className="text-sm opacity-70 mb-2">Quantidade</p>
                          <p className="font-bold text-xl">📦 {displayAuction.quantity.toString()}</p>
                          <p className="text-xs opacity-60 mt-1">unidades</p>
                        </div>
                      )}
                      {displayAuction.location && (
                        <div className="bg-base-100 p-4 rounded-lg">
                          <p className="text-sm opacity-70 mb-2">Localização</p>
                          <p className="font-bold text-xl">📍 {displayAuction.location}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="divider"></div>

              {/* Informações do Leilão */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm opacity-70">Vendedor</p>
                  <Address address={displayAuction.seller} size="sm" />
                </div>
                <div>
                  <p className="text-sm opacity-70">Tempo Restante</p>
                  <p className="font-bold flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    {hasEnded ? "Encerrado" : formatTimeRemaining(displayAuction.biddingEnds)}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Valor Avaliado</p>
                  <p className="font-bold">{formatEther(displayAuction.minDeposit * 2n)} USDC</p>
                  <p className="text-xs opacity-60 mt-1">
                    Lance mínimo: {formatEther(displayAuction.minDeposit)} USDC (50%)
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Total de Lances</p>
                  <p className="font-bold text-primary text-xl">
                    {loadingBids ? <span className="loading loading-spinner loading-sm"></span> : totalBids}
                  </p>
                </div>
              </div>

              {displayAuction.winner !== "0x0000000000000000000000000000000000000000" && (
                <div className="mt-4 p-4 bg-success/10 rounded-lg">
                  <p className="text-sm font-semibold mb-2">🏆 Vencedor:</p>
                  <Address address={displayAuction.winner} />
                </div>
              )}

              {/* Botão para cancelar leilão sem lances */}
              {hasEnded &&
                !displayAuction.finalized &&
                totalBids === 0 &&
                connectedAddress?.toLowerCase() === displayAuction.seller.toLowerCase() && (
                  <div className="mt-4 p-4 bg-warning/10 rounded-lg border border-warning">
                    <p className="text-sm font-semibold mb-2">⚠️ Leilão Expirado Sem Lances</p>
                    <p className="text-xs opacity-70 mb-3">
                      Este leilão terminou sem receber lances. Você pode cancelá-lo e recuperar seu NFT.
                    </p>
                    <button
                      className="btn btn-warning btn-sm w-full"
                      onClick={async () => {
                        try {
                          setIsApproving(true);
                          await cancelAuctionTx({
                            functionName: "cancelAuction",
                            args: [BigInt(auctionId)],
                          });
                          notification.success("Leilão cancelado! NFT devolvido.");
                        } catch (error: any) {
                          notification.error(error.message || "Erro ao cancelar leilão");
                        } finally {
                          setIsApproving(false);
                        }
                      }}
                      disabled={isApproving}
                    >
                      {isApproving ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          Cancelando...
                        </>
                      ) : (
                        "Cancelar Leilão e Recuperar NFT"
                      )}
                    </button>
                  </div>
                )}
            </div>
          </div>

          {/* Histórico de Lances */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-title">Meus Lances</h3>
                {totalBids > 0 && (
                  <span className="badge badge-primary">
                    {totalBids} {totalBids === 1 ? "lance" : "lances"}
                  </span>
                )}
              </div>

              {!connectedAddress ? (
                <div className="text-center py-8 bg-base-200 rounded-lg">
                  <p className="text-sm opacity-70">Conecte sua carteira para ver seus lances</p>
                </div>
              ) : loadingBids ? (
                <div className="text-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                  <p className="text-sm opacity-70 mt-2">Carregando seus lances...</p>
                </div>
              ) : totalBids === 0 ? (
                <div className="text-center py-8 bg-base-200 rounded-lg">
                  <p className="text-sm opacity-70">Você ainda não deu nenhum lance</p>
                  <p className="text-xs opacity-50 mt-1">🔒 Lances são privados - apenas você vê seus lances</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myBids
                    .slice()
                    .reverse()
                    .map((event, idx) => (
                      <div
                        key={`${event.transactionHash}-${idx}`}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          idx === 0 ? "bg-success/10 border-success" : "bg-base-200 border-base-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Address address={event.args.bidder as `0x${string}`} size="sm" />
                              {idx === 0 && <span className="badge badge-success badge-sm">🏆 Maior Lance</span>}
                            </div>
                            <p className="text-xs opacity-60">Bloco #{event.blockNumber?.toString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${idx === 0 ? "text-success text-2xl" : "text-lg"}`}>
                              {formatEther(event.args.amount || 0n)} USDC
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Dar Lance */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-md sticky top-4">
            <div className="card-body">
              <h3 className="card-title">Dar Lance</h3>

              {!connectedAddress ? (
                <div className="text-center py-8">
                  <p className="text-sm opacity-70 mb-4">Conecte sua carteira para participar</p>
                  <button className="btn btn-primary btn-sm">Conectar Carteira</button>
                </div>
              ) : !isActive || hasEnded ? (
                <div className="alert alert-warning">
                  <p className="text-sm">Este leilão já foi encerrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Saldo de USDC */}
                  <div className={`alert ${!usdcBalance || usdcBalance === 0n ? "alert-warning" : "alert-info"}`}>
                    <div className="w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Seu Saldo USDC:</span>
                        <span className="text-lg font-bold">{usdcBalance ? formatEther(usdcBalance) : "0"} USDC</span>
                      </div>
                      {(!usdcBalance || usdcBalance === 0n) && (
                        <>
                          <p className="text-xs mt-2 opacity-80">⚠️ Você precisa de tokens USDC para dar lances</p>
                          <button
                            className="btn btn-sm btn-primary w-full mt-2"
                            onClick={handleMintTokens}
                            disabled={isApproving}
                          >
                            {isApproving ? (
                              <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Depositando ETH...
                              </>
                            ) : (
                              "💰 Depositar 10 ETH → Obter 10.000 USDC"
                            )}
                          </button>
                          <p className="text-xs mt-2 opacity-60">
                            💡 Você depositará 10 ETH como colateral no VaultManager para mintar 10.000 USDC
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Valor do Lance (USDC)</span>
                      <span className="label-text-alt">Máx: {usdcBalance ? formatEther(usdcBalance) : "0"} USDC</span>
                    </label>
                    <div className="input-group">
                      <span className="bg-base-200 px-4 flex items-center">
                        <CurrencyDollarIcon className="w-5 h-5" />
                      </span>
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        placeholder={`Mínimo: ${formatEther(displayAuction.minDeposit)}`}
                        className={`input input-bordered w-full ${
                          bidAmount && parseEther(bidAmount) > (usdcBalance || 0n) ? "input-error" : ""
                        }`}
                        min={formatEther(displayAuction.minDeposit)}
                        max={usdcBalance ? formatEther(usdcBalance) : "0"}
                      />
                    </div>
                    <label className="label">
                      <span className="label-text-alt opacity-70">
                        {bidAmount && parseEther(bidAmount) > (usdcBalance || 0n) ? (
                          <span className="text-error">⚠️ Valor maior que seu saldo!</span>
                        ) : (
                          `Total de lances: ${displayAuction.bidCount.toString()}`
                        )}
                      </span>
                    </label>
                  </div>

                  {needsApproval && bidAmount && (
                    <button className="btn btn-secondary w-full" onClick={handleApprove} disabled={isApproving}>
                      {isApproving ? (
                        <>
                          <span className="loading loading-spinner"></span>
                          Aprovando...
                        </>
                      ) : (
                        "1. Aprovar USDC"
                      )}
                    </button>
                  )}

                  <button
                    className="btn btn-primary w-full"
                    onClick={handlePlaceBid}
                    disabled={
                      isPlacingBid ||
                      needsApproval ||
                      !bidAmount ||
                      (bidAmount && parseEther(bidAmount) > (usdcBalance || 0n))
                    }
                  >
                    {isPlacingBid ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processando...
                      </>
                    ) : needsApproval ? (
                      "2. Dar Lance"
                    ) : bidAmount && parseEther(bidAmount) > (usdcBalance || 0n) ? (
                      "❌ Saldo Insuficiente"
                    ) : (
                      "Dar Lance"
                    )}
                  </button>

                  <div className="alert alert-info">
                    <div className="text-xs">
                      <p className="font-semibold mb-1">💡 Como funciona:</p>
                      <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>Aprove o token USDC primeiro</li>
                        <li>Dê seu lance em USDC</li>
                        <li>O maior lance vence ao final</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;
