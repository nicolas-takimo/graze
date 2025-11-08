"use client";

import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ArrowDownTrayIcon, DocumentTextIcon, LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

const mockDocuments = [
  {
    id: "1",
    name: "Certificado_Sanitario.pdf",
    assetTitle: "Lote de Gado Nelore",
    size: 245000,
    uploadedAt: Date.now() / 1000 - 86400,
    hasAccess: true,
  },
];

const Vault: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  if (!connectedAddress) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 text-center">
        <LockClosedIcon className="w-16 h-16 mx-auto opacity-30 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Conecte sua Carteira</h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheckIcon className="w-10 h-10 text-primary" />
        <h1 className="text-4xl font-bold">Vault Criptografado</h1>
      </div>

      <div className="alert alert-info mb-6">
        <ShieldCheckIcon className="w-6 h-6" />
        <div>
          <h3 className="font-bold">Sobre o Vault</h3>
          <p className="text-sm">Documentos criptografados e acessíveis apenas para usuários autorizados</p>
        </div>
      </div>

      <div className="space-y-4">
        {mockDocuments.map(doc => (
          <div key={doc.id} className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <DocumentTextIcon className="w-8 h-8 text-error" />
                  <div>
                    <h3 className="font-bold">{doc.name}</h3>
                    <p className="text-sm opacity-70">{doc.assetTitle}</p>
                    <p className="text-xs opacity-50">
                      {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.uploadedAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {doc.hasAccess ? (
                  <button className="btn btn-primary btn-sm gap-1">
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Baixar
                  </button>
                ) : (
                  <button className="btn btn-outline btn-sm" disabled>
                    <LockClosedIcon className="w-4 h-4" />
                    Sem Acesso
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Vault;
