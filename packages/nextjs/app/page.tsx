"use client";

import { useEffect, useMemo, useState } from "react";
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
  TagIcon,
} from "@heroicons/react/24/outline";
import { useAuctionCreatedEvents, useNextAuctionId } from "~~/hooks/graze";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Dashboard: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  // Buscar eventos de leilões criados
  const { events: auctionEvents, isLoading: loadingEvents } = useAuctionCreatedEvents();
  const nextAuctionId = useNextAuctionId();

  // Estado para armazenar dados completos dos leilões
  const [auctionsWithDetails, setAuctionsWithDetails] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Buscar detalhes de cada leilão
  useEffect(() => {
    const fetchAuctionDetails = async () => {
      if (!auctionEvents || auctionEvents.length === 0) return;

      setIsLoadingDetails(true);

      // Aqui você pode fazer chamadas para buscar detalhes de cada leilão
      // Por enquanto, vamos processar os eventos
      const auctionsData = auctionEvents.map((event: any) => ({
        id: event.args.id?.toString() || "0",
        tokenId: event.args.tokenId || 0n,
        title: `Leilão #${event.args.id?.toString() || "0"}`,
        category: "Gado",
        seller: event.args.seller as `0x${string}`,
        currentPrice: 0n,
        endTime: Number(event.args.biddingEnds || 0),
        bidsCount: 0,
        hasPrivateData: event.args.encrypted || false,
        location: "Brasil",
        isActive: Number(event.args.biddingEnds || 0) > Date.now() / 1000,
      }));

      setAuctionsWithDetails(auctionsData);
      setIsLoadingDetails(false);
    };

    fetchAuctionDetails();
  }, [auctionEvents]);

  // Processar leilões com fallback para mock
  const auctions = useMemo(() => {
    if (auctionsWithDetails.length > 0) {
      return auctionsWithDetails;
    }

    // Fallback para dados mock se não houver contratos deployed
    return [
      {
        id: "1",
        tokenId: 1n,
        title: "Lote de Gado Nelore Premium",
        category: "Gado",
        seller: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        currentPrice: 0n,
        endTime: Date.now() / 1000 + 172800,
        bidsCount: 0,
        hasPrivateData: true,
        location: "Goiás, Brasil",
        isActive: true,
      },
    ];
  }, [auctionsWithDetails]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const activeAuctions = auctions.filter(a => a.isActive).length;
    const totalVolume = auctions.reduce((sum, a) => sum + Number(a.currentPrice), 0);

    return {
      activeAuctions,
      totalVolume: totalVolume > 0 ? `$${(totalVolume / 1e18).toFixed(2)}` : "$0",
      totalCreated: nextAuctionId.toString(),
    };
  }, [auctions, nextAuctionId]);

  const isLoading = loadingEvents || isLoadingDetails;

  const formatTimeRemaining = (endTime: number) => {
    const timeRemaining = Math.max(0, endTime - Date.now() / 1000);
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

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
                <p className="text-sm text-base-content opacity-70 mb-1">Leilões Ativos</p>
                <p className="text-3xl font-bold">{stats.activeAuctions}</p>
              </div>
              <BanknotesIcon className="w-8 h-8 text-accent opacity-80" />
            </div>
          </div>
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">Tempo Médio</p>
                <p className="text-3xl font-bold">48h</p>
              </div>
              <ClockIcon className="w-8 h-8 text-info opacity-80" />
            </div>
          </div>
          <div className="card bg-base-100 shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-base-content opacity-70 mb-1">Últimas 24h</p>
                <p className="text-3xl font-bold">8</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-success opacity-80" />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 pb-12">
        <h2 className="text-2xl font-bold mb-6">Leilões em Andamento</h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <TagIcon className="w-16 h-16 mx-auto opacity-30 mb-4" />
            <p className="text-xl opacity-70">Nenhum leilão ativo no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map(auction => (
              <Link key={auction.id} href={`/auction/${auction.id}`}>
                <div className="card bg-base-100 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                  <figure className="relative h-48 bg-base-300">
                    <div className="w-full h-full flex items-center justify-center">
                      <TagIcon className="w-16 h-16 text-base-content opacity-20" />
                    </div>
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
                    <h3 className="card-title text-lg">
                      {auction.title}
                      <span className="badge badge-outline badge-sm">{auction.category}</span>
                    </h3>
                    <p className="text-sm opacity-70">NFT #{auction.tokenId.toString()}</p>
                    <div className="text-xs">
                      <span className="opacity-70">Vendedor: </span>
                      <Address address={auction.seller} size="xs" onlyEnsOrAddress />
                    </div>
                    <p className="text-xs opacity-60">{auction.location}</p>
                    <div className="mt-2">
                      <p className="text-sm opacity-70">Lance Atual</p>
                      <p className="text-2xl font-bold text-primary">
                        {auction.currentPrice > 0n ? formatEther(auction.currentPrice) : "0"} USDC
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="flex items-center gap-1 text-sm">
                        <ClockIcon className="w-4 h-4" />
                        <span>{formatTimeRemaining(auction.endTime)}</span>
                      </div>
                      <span className="text-sm opacity-70">{auction.bidsCount} lances</span>
                    </div>
                    <button className="btn btn-primary btn-sm mt-2">Ver Leilão</button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
