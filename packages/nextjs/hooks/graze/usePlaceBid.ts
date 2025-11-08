import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const usePlaceBid = () => {
  const [isPlacing, setIsPlacing] = useState(false);

  const { writeContractAsync: placeBidWrite, isMining } = useScaffoldWriteContract({
    contractName: "AuctionManager",
  });

  const placeBid = async (auctionId: bigint, amount: string) => {
    try {
      setIsPlacing(true);

      const amountInWei = parseEther(amount);

      await placeBidWrite({
        functionName: "placeBid",
        args: [auctionId, amountInWei],
      });

      notification.success("Lance realizado com sucesso!");
      return true;
    } catch (error: any) {
      console.error("Erro ao dar lance:", error);
      notification.error(error.message || "Erro ao dar lance");
      return false;
    } finally {
      setIsPlacing(false);
    }
  };

  return {
    placeBid,
    isPlacing: isPlacing || isMining,
  };
};