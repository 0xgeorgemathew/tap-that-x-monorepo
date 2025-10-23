"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Wallet, Zap } from "lucide-react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { StepIndicator } from "~~/components/StepIndicator";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import deployedContracts from "~~/contracts/deployedContracts";
import { useGaslessRelay } from "~~/hooks/useGaslessRelay";
import { useHaloChip } from "~~/hooks/useHaloChip";

type FlowState = "idle" | "detecting" | "authorizing" | "executing" | "success" | "error";

const EXECUTE_STEPS = [
  { label: "Detect Chip", description: "Hold device near NFC chip", timeEstimate: "2-3 sec" },
  { label: "Sign Authorization", description: "Tap chip to authorize", timeEstimate: "2-3 sec" },
  { label: "Execute Action", description: "Processing on blockchain", timeEstimate: "10-15 sec" },
];

export default function ExecutePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const PROTOCOL_ADDRESS = contracts?.TapThatXProtocol?.address;
  const EXECUTOR_ADDRESS = contracts?.TapThatXExecutor?.address;
  const CONFIGURATION_ADDRESS = contracts?.TapThatXConfiguration?.address;
  const REGISTRY_ADDRESS = contracts?.TapThatXRegistry?.address;

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [actionPreview, setActionPreview] = useState<{
    targetContract: string;
    description: string;
    isActive: boolean;
  } | null>(null);

  const { signMessage, signTypedData, isLoading } = useHaloChip();
  const { relayExecuteTap } = useGaslessRelay();

  const handleExecute = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    if (!contracts || !PROTOCOL_ADDRESS || !EXECUTOR_ADDRESS || !CONFIGURATION_ADDRESS || !REGISTRY_ADDRESS) {
      setStatusMessage(`Contracts not deployed on this network (chain ${chainId}). Please switch networks.`);
      setFlowState("error");
      return;
    }

    try {
      // Step 1: Detect chip
      setFlowState("detecting");
      setStatusMessage("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;

      // Check if chip is registered to user
      const hasChip = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "hasChip",
        args: [address, detectedChipAddress],
      })) as boolean;

      if (!hasChip) {
        setFlowState("error");
        setStatusMessage(
          `Error: Chip not registered to your account (${detectedChipAddress.slice(0, 10)}...). Please register at /register.`,
        );
        return;
      }

      // Fetch configuration
      const config = (await publicClient.readContract({
        address: CONFIGURATION_ADDRESS,
        abi: contracts.TapThatXConfiguration.abi,
        functionName: "getConfiguration",
        args: [address, detectedChipAddress],
      })) as { targetContract: string; staticCallData: string; description: string; isActive: boolean };

      if (config.targetContract === "0x0000000000000000000000000000000000000000") {
        setFlowState("error");
        setStatusMessage("No configuration found for this chip. Please configure at /configure.");
        return;
      }

      if (!config.isActive) {
        setFlowState("error");
        setStatusMessage("Configuration is inactive. Please activate it at /configure.");
        return;
      }

      setActionPreview(config);
      setStatusMessage("");

      // Step 2: Authorize execution
      await new Promise(resolve => setTimeout(resolve, 500));
      setFlowState("authorizing");
      setStatusMessage("Tap your chip again to authorize execution...");

      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      const chipSig = await signTypedData({
        domain: {
          name: "TapThatXProtocol",
          version: "1",
          verifyingContract: PROTOCOL_ADDRESS,
        },
        types: {
          CallAuthorization: [
            { name: "owner", type: "address" },
            { name: "target", type: "address" },
            { name: "callData", type: "bytes" },
            { name: "value", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "CallAuthorization",
        message: {
          owner: address,
          target: config.targetContract as `0x${string}`,
          callData: config.staticCallData as `0x${string}`,
          value: BigInt(0),
          timestamp: BigInt(timestamp),
          nonce,
        },
      });

      setStatusMessage("");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Execute via relayer
      setFlowState("executing");
      setStatusMessage("Executing action on blockchain...");

      await relayExecuteTap({
        owner: address,
        chip: detectedChipAddress,
        chipSignature: chipSig.signature,
        timestamp,
        nonce,
      });

      setStatusMessage("");
      await new Promise(resolve => setTimeout(resolve, 500));

      setFlowState("success");
      setStatusMessage(`Success! Action executed: ${config.description}`);
    } catch (err) {
      console.error("Execution failed:", err);
      setFlowState("error");
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Execution failed"}`);
    }
  };

  const resetFlow = () => {
    setFlowState("idle");
    setStatusMessage("");
    setActionPreview(null);
  };

  const allComplete = flowState === "success";

  return (
    <div className="flex items-start justify-center p-4 sm:p-6 pb-24">
      <div className="w-full max-w-lg">
        {/* Main Glass Card */}
        <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="round-icon w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-4">
              <Zap className="h-12 w-12 sm:h-14 sm:w-14" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">Tap to Execute</h1>
            <p className="text-sm sm:text-base text-base-content/70">Execute your pre-configured chip action</p>
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-3 sm:space-y-4 md:space-y-5 flex flex-col min-h-[100px] sm:min-h-[140px]">
            {/* Step Indicator - Show when flow is active */}
            {flowState !== "idle" && flowState !== "error" && (
              <StepIndicator
                steps={EXECUTE_STEPS}
                currentStep={
                  flowState === "detecting"
                    ? 0
                    : flowState === "authorizing"
                      ? 1
                      : flowState === "executing"
                        ? 2
                        : flowState === "success"
                          ? 3
                          : 0
                }
              />
            )}

            {/* Wallet Alert */}
            {!address && (
              <div className="glass-alert">
                <Wallet className="h-5 w-5 text-warning" />
                <span className="text-sm font-semibold text-base-content">Connect your wallet to execute</span>
              </div>
            )}

            {/* Network Alert */}
            {address && !contracts && (
              <div className="glass-alert">
                <AlertCircle className="h-5 w-5 text-warning" />
                <span className="text-sm font-semibold text-base-content">
                  Contracts not deployed on this network. Please switch networks.
                </span>
              </div>
            )}

            {/* Action Preview */}
            {actionPreview && flowState !== "success" && flowState !== "error" && (
              <div className="glass-alert fade-in">
                <CheckCircle2 className="h-5 w-5 text-info" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-base-content">Ready to Execute</p>
                  <p className="text-xs text-base-content/70 mt-1">{actionPreview.description}</p>
                  <p className="text-xs text-base-content/50 mt-1 font-mono">
                    Target: {actionPreview.targetContract.slice(0, 6)}...{actionPreview.targetContract.slice(-4)}
                  </p>
                </div>
              </div>
            )}

            {/* Dynamic Status Display */}
            {flowState !== "idle" && flowState !== "success" && statusMessage && (
              <div className="text-center py-3 fade-in">
                <div className="flex items-center justify-center gap-2.5">
                  {flowState === "error" ? (
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-error flex-shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin flex-shrink-0" />
                  )}
                  <p className="text-base sm:text-lg md:text-xl font-bold text-base-content">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Step Complete Indicators */}
            {flowState === "detecting" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Chip detected</p>
              </div>
            )}

            {flowState === "authorizing" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Authorization signed</p>
              </div>
            )}

            {flowState === "executing" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Action executing...</p>
              </div>
            )}

            {/* Success State */}
            {flowState === "success" && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-3" />
                <p className="text-lg font-semibold text-base-content mb-2">Execution Complete!</p>
                {actionPreview && <p className="text-sm text-base-content/70">{actionPreview.description}</p>}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-4 sm:mt-6 space-y-4">
            {allComplete ? (
              <button onClick={resetFlow} className="glass-btn flex items-center justify-center gap-3 w-full">
                <Zap className="h-6 w-6" />
                <span>Execute Another Action</span>
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={isLoading || !address || !contracts}
                className="glass-btn flex items-center justify-center gap-3 w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-6 w-6" />
                    <span>Execute Tap</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
