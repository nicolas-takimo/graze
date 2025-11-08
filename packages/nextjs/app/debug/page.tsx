import { DebugContracts } from "./_components/DebugContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Debug Contracts",
  description: "Debug your deployed 🏗 Scaffold-ETH 2 contracts in an easy way",
});

const Debug: NextPage = () => {
  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-primary">Debug Contracts</h1>
          <div className="text-base-content opacity-70">
            Interaja diretamente com os contratos deployados do AgroAsset DeFi
          </div>
        </div>
        <DebugContracts />
        <div className="text-center mt-8 bg-primary/5 rounded-xl p-8 border-2 border-primary/20">
          <h2 className="text-2xl font-bold mb-3 text-primary">💡 Como Usar</h2>
          <div className="text-left max-w-2xl mx-auto space-y-2">
            <div className="text-sm">
              ✅ <strong>Read:</strong> Consulte dados dos contratos sem gastar gas
            </div>
            <div className="text-sm">
              ✅ <strong>Write:</strong> Execute transações que modificam o estado
            </div>
            <div className="text-sm">
              ✅ <strong>Events:</strong> Monitore eventos emitidos pelos contratos
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Debug;
