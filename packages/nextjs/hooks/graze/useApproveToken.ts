import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const useApproveToken = (tokenContractName: "StableToken" = "StableToken") => {
  const [isApproving, setIsApproving] = useState(false);

  const { writeContractAsync: approveWrite, isMining } = useScaffoldWriteContract({
    contractName: tokenContractName,
  });

  // Buscar o endereço do AuctionManager
  const { data: auctionManagerAddress } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "owner", // Apenas para pegar o endereço do contrato
  });

  const approve = async (spender: string, amount: string) => {
    try {
      setIsApproving(true);

      const amountInWei = parseEther(amount);

      await approveWrite({
        functionName: "approve",
        args: [spender, amountInWei],
      });

      notification.success("Token aprovado com sucesso!");
      return true;
    } catch (error: any) {
      console.error("Erro ao aprovar token:", error);
      notification.error(error.message || "Erro ao aprovar token");
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  return {
    approve,
    isApproving: isApproving || isMining,
  };
};