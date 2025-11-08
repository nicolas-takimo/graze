import { useState } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const useCreateAuction = () => {
  const [isCreating, setIsCreating] = useState(false);

  const { writeContractAsync: createAuctionWrite, isMining } = useScaffoldWriteContract({
    contractName: "AuctionManager",
  });

  const createAuction = async (
    nftContract: string,
    tokenId: bigint,
    stableToken: string,
    biddingEnds: bigint,
    usesEncrypted: boolean,
    minDeposit: bigint,
  ) => {
    try {
      setIsCreating(true);

      const txHash = await createAuctionWrite({
        functionName: "createAuction",
        args: [nftContract, tokenId, stableToken, biddingEnds, usesEncrypted, minDeposit],
      });

      notification.success("Leilão criado com sucesso!");
      return txHash;
    } catch (error: any) {
      console.error("Erro ao criar leilão:", error);
      notification.error(error.message || "Erro ao criar leilão");
      return undefined;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createAuction,
    isCreating: isCreating || isMining,
  };
};
