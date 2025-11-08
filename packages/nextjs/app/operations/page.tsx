"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { ChartBarIcon } from "@heroicons/react/24/outline";

const mockOperations = [
  {
    id: "1",
    type: "created",
    auctionId: "1",
    title: "Lote de Gado Nelore Premium",
    status: "active",
    currentPrice: parseEther("75000"),
    timestamp: Date.now() / 1000 - 86400 * 2,
  },
];

const Operations: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  if (!connectedAddress) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 text-center">
        <ChartBarIcon className="w-16 h-16 mx-auto opacity-30 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Conecte sua Carteira</h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Minhas Operações</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card bg-base-100 shadow-md p-6">
          <p className="text-sm opacity-70 mb-1">Leilões Criados</p>
          <p className="text-3xl font-bold">3</p>
        </div>
        <div className="card bg-base-100 shadow-md p-6">
          <p className="text-sm opacity-70 mb-1">Participações</p>
          <p className="text-3xl font-bold">5</p>
        </div>
        <div className="card bg-base-100 shadow-md p-6">
          <p className="text-sm opacity-70 mb-1">Leilões Vencidos</p>
          <p className="text-3xl font-bold">2</p>
        </div>
      </div>

      <div className="space-y-4">
        {mockOperations.map(op => (
          <div key={op.id} className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{op.title}</h3>
                  <p className="text-sm opacity-70">Status: {op.status}</p>
                  <p className="text-lg font-bold text-primary mt-2">{formatEther(op.currentPrice)} AUSD</p>
                </div>
                <Link href={`/auction/${op.auctionId}`} className="btn btn-primary">
                  Ver Leilão
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Operations;
