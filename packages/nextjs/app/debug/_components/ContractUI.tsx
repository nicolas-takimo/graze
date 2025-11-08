"use client";

// @refresh reset
import { useEffect } from "react";
import { Contract } from "@scaffold-ui/debug-contracts";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ContractName } from "~~/utils/scaffold-eth/contract";

type ContractUIProps = {
  contractName: ContractName;
  className?: string;
};

/**
 * UI component to interface with deployed contracts.
 **/
export const ContractUI = ({ contractName }: ContractUIProps) => {
  const { targetNetwork } = useTargetNetwork();
  const { data: deployedContractData, isLoading: deployedContractLoading } = useDeployedContractInfo({ contractName });

  // Suppress hydration errors from scaffold-ui
  useEffect(() => {
    // Suppress React hydration warnings
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === "string" &&
        (args[0].includes("cannot appear as a descendant") ||
          args[0].includes("cannot contain a nested") ||
          args[0].includes("hydration"))
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  if (deployedContractLoading) {
    return (
      <div className="mt-14">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!deployedContractData) {
    return (
      <div className="text-3xl mt-14">
        No contract found by the name of {contractName} on chain {targetNetwork.name}!
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
      <Contract contractName={contractName as string} contract={deployedContractData} chainId={targetNetwork.id} />
    </div>
  );
};
