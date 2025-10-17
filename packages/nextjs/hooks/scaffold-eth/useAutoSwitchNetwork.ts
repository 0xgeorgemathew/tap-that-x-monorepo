"use client";

import { useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Automatically prompts user to switch to a supported network when connected to wrong network
 * Helps prevent "wrong network" errors by being proactive
 */
export const useAutoSwitchNetwork = () => {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (!isConnected || !chain) return;

    // Check if current chain is in our supported networks
    const isSupportedNetwork = scaffoldConfig.targetNetworks.some(network => network.id === chain.id);

    if (!isSupportedNetwork && switchChain) {
      // Automatically switch to default network (Base Sepolia)
      const defaultNetwork = scaffoldConfig.targetNetworks[0];

      console.log(`🔄 Auto-switching from ${chain.name} to ${defaultNetwork.name}`);

      // Small delay to avoid race conditions
      setTimeout(() => {
        switchChain({ chainId: defaultNetwork.id });
      }, 100);
    }
  }, [chain, isConnected, switchChain]);
};
