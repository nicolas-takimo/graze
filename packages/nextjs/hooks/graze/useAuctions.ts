import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

/**
 * Hook para buscar informações de um leilão específico
 */
export const useAuction = (auctionId: bigint | undefined) => {
  const { data: auction, isLoading } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "auctions",
    args: auctionId !== undefined ? [auctionId] : undefined,
  });

  return {
    auction,
    isLoading,
  };
};

/**
 * Hook para buscar o histórico de lances de um leilão
 */
export const useAuctionBids = (auctionId: bigint | undefined) => {
  const { data: bids, isLoading } = useScaffoldEventHistory({
    contractName: "AuctionManager",
    eventName: "BidPlaced",
    filters: auctionId !== undefined ? { id: auctionId } : undefined,
    watch: true,
  });

  return {
    bids: bids || [],
    isLoading,
  };
};

/**
 * Hook para buscar todos os leilões criados
 */
export const useAuctionCreatedEvents = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "AuctionManager",
    eventName: "AuctionCreated",
    watch: true,
  });

  return {
    events: events || [],
    isLoading,
  };
};

/**
 * Hook para buscar o número do próximo leilão (total de leilões)
 */
export const useNextAuctionId = () => {
  const { data: nextAuction } = useScaffoldReadContract({
    contractName: "AuctionManager",
    functionName: "nextAuction",
  });

  return nextAuction || 0n;
};