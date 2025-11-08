import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const useUserNFTs = () => {
  const { address } = useAccount();

  const { data: balance, isLoading } = useScaffoldReadContract({
    contractName: "AgroAsset",
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  return {
    nftCount: balance || 0n,
    isLoading,
  };
};