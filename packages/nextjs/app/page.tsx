"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import {
  BanknotesIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

// Componente para card individual de leilão
const AuctionCard = ({ auctionId }: { auctionId: bigint }) => {
  const { data: auctionData } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "auctions",
    args: [auctionId],
  });

  // Buscar tokenId para depois buscar metadados
  const tokenId = useMemo(() => {
    if (!auctionData) return null;
    return auctionData[2] as bigint;
  }, [auctionData]);

  const { data: assetMetadata } = useScaffoldReadContract({
    contractName: "AgroAsset",
    functionName: "assetInfo",
    args: tokenId !== null ? [tokenId] : [0n],
  });

  const auction = useMemo(() => {
    if (!auctionData) return null;

    // Struct Auction: seller, nftContract, tokenId, stableToken, biddingEnds, finalized, usesEncrypted, minDeposit, winner, bidCount
    const seller = auctionData[0] as `0x${string}`;
    const tokenId = auctionData[2] as bigint;
    const biddingEnds = auctionData[4] as bigint;
    const finalized = auctionData[5] as boolean;
    const encrypted = auctionData[6] as boolean;
    const minDeposit = auctionData[7] as bigint;

    const hasEnded = Number(biddingEnds) < Date.now() / 1000;
    const isActive = !finalized && !hasEnded;

    const baseAuction = {
      id: auctionId.toString(),
      tokenId,
      seller,
      currentPrice: minDeposit,
      endTime: Number(biddingEnds),
      hasPrivateData: encrypted,
      isActive,
      assetType: assetMetadata ? (assetMetadata[0] as string) : undefined,
      quantity: assetMetadata ? (assetMetadata[1] as bigint) : undefined,
      location: assetMetadata ? (assetMetadata[2] as string) : undefined,
    };

    return baseAuction;
  }, [auctionData, auctionId, assetMetadata]);

  const formatTimeRemaining = (endTime: number) => {
    const timeRemaining = Math.max(0, endTime - Date.now() / 1000);
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

  if (!auction) {
    return (
      <div className="card bg-base-100 shadow-md h-full">
        <div className="card-body items-center justify-center">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      </div>
    );
  }

  const getAssetIcon = (assetType?: string) => {
    if (!assetType) return "🌾";
    const type = assetType.toLowerCase();
    if (type.includes("gado") || type.includes("boi") || type.includes("vaca")) return "🐄";
    if (type.includes("soja")) return "🌱";
    if (type.includes("milho")) return "🌽";
    if (type.includes("café")) return "☕";
    if (type.includes("trigo")) return "🌾";
    if (type.includes("terra") || type.includes("fazenda")) return "🏞️";
    return "🌾";
  };

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
      <figure className="relative h-48 bg-gradient-to-br from-green-100 to-blue-100">
        <div className="w-full h-full flex items-center justify-center text-6xl">{getAssetIcon(auction.assetType)}</div>
        <div className="absolute top-2 right-2">
          {auction.isActive ? (
            <span className="badge badge-success">Ativo</span>
          ) : (
            <span className="badge badge-error">Encerrado</span>
          )}
        </div>
        {auction.hasPrivateData && (
          <div className="absolute top-2 left-2">
            <span className="badge badge-secondary gap-1">
              <LockClosedIcon className="w-3 h-3" />
              Privado
            </span>
          </div>
        )}
      </figure>
      <div className="card-body p-4">
        <h3 className="card-title text-lg">Leilão #{auction.id}</h3>

        {/* Tipo de Ativo em Destaque */}
        {auction.assetType && (
          <div className="my-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-xs opacity-70 mb-1">Tipo de Ativo</p>
            <p className="font-bold text-lg text-primary">{auction.assetType}</p>
          </div>
        )}

        <p className="text-sm opacity-70">NFT #{auction.tokenId.toString()}</p>

        <div className="flex gap-2 flex-wrap mt-2">
          {auction.quantity && (
            <div className="badge badge-primary gap-1">📦 {auction.quantity.toString()} unidades</div>
          )}
          {auction.location && <div className="badge badge-outline gap-1">📍 {auction.location}</div>}
        </div>

        <div className="text-xs mt-2">
          <span className="opacity-70">Vendedor: </span>
          <Address address={auction.seller} size="xs" onlyEnsOrAddress disableAddressLink />
        </div>
        <div className="mt-2">
          <p className="text-sm opacity-70">Lance Mínimo</p>
          <p className="text-2xl font-bold text-primary">
            {auction.currentPrice > 0n ? formatEther(auction.currentPrice) : "0"} USDC
          </p>
          <p className="text-xs opacity-50 mt-1">50% do valor avaliado</p>
        </div>
        <div className="flex items-center gap-1 text-sm mt-4 pt-4 border-t">
          <ClockIcon className="w-4 h-4" />
          <span>{auction.isActive ? formatTimeRemaining(auction.endTime) : "Encerrado"}</span>
        </div>
        <Link href={`/auction/${auction.id}`} className="btn btn-primary btn-sm mt-2">
          Ver Leilão
        </Link>
      </div>
    </div>
  );
};

const Dashboard: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  // Buscar dados dos contratos
  const { data: nextAuctionId } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "nextAuction",
  });

  // Buscar leilões criados
  const totalAuctions = Number(nextAuctionId || 0n);

  // Buscar dados de cada leilão
  const auctionIds = Array.from({ length: totalAuctions }, (_, i) => BigInt(i));

  // Buscar primeiro leilão para calcular tempo médio
  const { data: firstAuction } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "auctions",
    args: totalAuctions > 0 ? [0n] : [0n],
  });

  // Calcular estatísticas
  const stats = useMemo(() => {
    let avgTime = "N/A";

    // Se tiver pelo menos um leilão, calcular tempo médio baseado no primeiro
    if (firstAuction && totalAuctions > 0) {
      const biddingEnds = Number(firstAuction[4] as bigint);
      const now = Date.now() / 1000;
      const timeRemaining = Math.max(0, biddingEnds - now);
      const hours = Math.floor(timeRemaining / 3600);

      if (hours > 24) {
        avgTime = `${Math.floor(hours / 24)}d`;
      } else if (hours > 0) {
        avgTime = `${hours}h`;
      } else {
        avgTime = "< 1h";
      }
    }

    return {
      totalCreated: nextAuctionId?.toString() || "0",
      avgTime,
    };
  }, [nextAuctionId, firstAuction, totalAuctions]);

  const isLoading = !nextAuctionId;

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-base-content mb-2">Leilões Agropecuários</h1>
              <p className="text-lg text-base-content opacity-70">
                Invista em ativos agrícolas tokenizados com transparência e segurança
              </p>
            </div>
            {connectedAddress && (
              <Link href="/create" className="btn btn-primary btn-lg gap-2">
                <PlusCircleIcon className="w-6 h-6" />
                Criar Ativo
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 -mt-8 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">Total de Leilões</p>
                <p className="text-3xl font-bold">{stats.totalCreated}</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-primary opacity-80" />
            </div>
          </div>
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">
                  {connectedAddress ? "Sua Carteira" : "Conecte sua carteira"}
                </p>
                <p className="text-xl font-bold">{connectedAddress ? "Conectada ✓" : "Para ver mais"}</p>
              </div>
              <BanknotesIcon className="w-8 h-8 text-accent opacity-80" />
            </div>
          </div>
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">Tempo Médio</p>
                <p className="text-xl font-bold">{stats.avgTime}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-primary opacity-80" />
            </div>
          </div>
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">Blockchain</p>
                <p className="text-xl font-bold">{targetNetwork.name}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-success opacity-80" />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Leilões Ativos</h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : totalAuctions === 0 ? (
          <div className="text-center py-16 bg-base-200/50 rounded-xl">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🌾</div>
              <h3 className="text-2xl font-bold mb-2 text-base-content">Nenhum leilão ativo no momento</h3>
              <p className="text-sm opacity-60">Novos leilões de ativos agropecuários serão exibidos aqui</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctionIds.map(id => (
              <AuctionCard key={id.toString()} auctionId={id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
