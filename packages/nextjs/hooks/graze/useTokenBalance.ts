import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const useTokenBalance = (tokenContractName: "StableToken" = "StableToken") => {
  const { address } = useAccount();

  const { data: balance, isLoading } = useScaffoldReadContract({
    contractName: tokenContractName,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  return {
    balance: balance || 0n,
    isLoading,
  };
};
