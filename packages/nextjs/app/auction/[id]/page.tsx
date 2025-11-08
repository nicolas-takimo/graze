"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";

const AuctionDetail: NextPage = () => {
  const params = useParams();
  const auctionId = params?.id as string;
  const { address: connectedAddress } = useAccount();
  const [bidAmount, setBidAmount] = useState("");
  const [isPlacingBid, setIsPlacingBid] = useState(false);

  const auction = {
    id: auctionId,
    title: "Lote de Gado Nelore Premium",
    description: "Lote de 100 cabeças de gado Nelore certificado.",
    seller: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    currentPrice: parseEther("75000"),
    endTime: Date.now() / 1000 + 172800,
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Link href="/" className="btn btn-ghost btn-sm gap-2 mb-6">
        <ArrowLeftIcon className="w-4 h-4" />
        Voltar
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-md">
            <figure className="h-96 bg-base-300 flex items-center justify-center">
              <span className="text-6xl">🐄</span>
            </figure>
            <div className="card-body">
              <h2 className="card-title text-2xl">Leilão #{auctionId}</h2>
              <p className="opacity-80">NFT ID: {displayAuction.tokenId?.toString()}</p>

              <div className="divider"></div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">Histórico de Lances</h3>
                {bids.length > 0 && <span className="badge badge-primary">{bids.length} lances</span>}
              </div>

              {loadingBids ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : bids.length === 0 ? (
                <div className="text-center py-6 bg-base-200 rounded-lg">
                  <p className="text-sm opacity-70">Nenhum lance ainda</p>
                  <p className="text-xs opacity-50 mt-1">Seja o primeiro a dar um lance!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {[...bids]
                    .sort((a: any, b: any) => {
                      const amountA = Number(a.args.amount || 0n);
                      const amountB = Number(b.args.amount || 0n);
                      return amountB - amountA; // Maior lance primeiro
                    })
                    .map((bid: any, idx: number) => {
                      const isHighest = idx === 0;
                      const bidAmount = bid.args.amount || 0n;

                      return (
                        <div
                          key={`${bid.transactionHash}-${idx}`}
                          className={`p-3 rounded-lg transition-all ${
                            isHighest ? "bg-primary/10 border-2 border-primary" : "bg-base-200 hover:bg-base-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Address address={bid.args.bidder} size="sm" />
                                {isHighest && <span className="badge badge-success badge-xs">Maior Lance</span>}
                              </div>
                              <p className="text-xs opacity-50 mt-1">
                                {bid.blockNumber ? `Bloco #${bid.blockNumber.toString()}` : "Processando..."}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${isHighest ? "text-primary text-lg" : "text-base-content"}`}>
                                {formatEther(bidAmount)} USDC
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {bids.length > 0 && (
                <div className="mt-4 p-3 bg-info/10 rounded-lg">
                  <p className="text-xs opacity-70">💡 Os lances são atualizados automaticamente em tempo real</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            {loadingAuction ? (
              <span className="loading loading-spinner"></span>
            ) : (
              <>
                <p className="text-sm opacity-70">Vendedor</p>
                <Address address={displayAuction.seller} />

                <div className="divider"></div>

                <p className="text-sm opacity-70">Status</p>
                <p className="text-lg font-semibold">
                  {displayAuction.finalized ? (
                    <span className="badge badge-error">Finalizado</span>
                  ) : (
                    <span className="badge badge-success">Ativo</span>
                  )}
                </p>

                <div className="divider"></div>

                <p className="text-sm opacity-70">Maior Lance Atual</p>
                <p className="text-4xl font-bold text-primary">
                  {highestBid > 0n ? formatEther(highestBid) : "0"} USDC
                </p>
                {bids.length > 0 && (
                  <>
                    <p className="text-xs opacity-50 mt-1">
                      {bids.length} {bids.length === 1 ? "lance" : "lances"} recebido{bids.length === 1 ? "" : "s"}
                    </p>
                    {currentWinner && (
                      <div className="mt-2 p-2 bg-success/10 rounded">
                        <p className="text-xs font-semibold">Vencedor Atual:</p>
                        <Address address={currentWinner as `0x${string}`} size="xs" />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="divider"></div>

            {connectedAddress ? (
              <div className="space-y-4">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder="Seu lance em USDC"
                  className="input input-bordered w-full"
                />
                {needsApproval && (
                  <button
                    className="btn btn-secondary w-full mb-2"
                    onClick={async () => {
                      const success = await approve("0x52173b6ac069619c206b9A0e75609fC92860AB2A", "1000000");
                      if (success) setNeedsApproval(false);
                    }}
                    disabled={isApproving}
                  >
                    {isApproving ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Aprovando...
                      </>
                    ) : (
                      "Aprovar USDC"
                    )}
                  </button>
                )}
                <button
                  className="btn btn-primary w-full"
                  onClick={async () => {
                    if (!bidAmount) return;
                    const success = await placeBid(auctionIdBigInt, bidAmount);
                    if (success) {
                      setBidAmount("");
                    }
                  }}
                  disabled={!bidAmount || isPlacing || needsApproval}
                >
                  {isPlacing ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Processando...
                    </>
                  ) : (
                    "Dar Lance"
                  )}
                </button>
              </div>
            ) : (
              <div className="alert alert-warning">
                <span>Conecte sua carteira</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;
