"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Nfc, Wallet } from "lucide-react";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { StepIndicator } from "~~/components/StepIndicator";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

type FlowState = "idle" | "reading" | "signing" | "confirming" | "success" | "error";

const REGISTRATION_STEPS = [
  { label: "Detect Chip", description: "Hold device near NFC chip", timeEstimate: "2-3 sec" },
  { label: "Sign Authorization", description: "Tap chip to authorize", timeEstimate: "2-3 sec" },
  { label: "Confirm Transaction", description: "Confirm in wallet", timeEstimate: "5-10 sec" },
];

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const chainId = useChainId();
  const { signMessage, signTypedData, isLoading } = useHaloChip();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [registeredChipAddress, setRegisteredChipAddress] = useState<string>("");
  const [detectedChip, setDetectedChip] = useState<string>("");

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const registryAddress = contracts?.TapThatXRegistry?.address;
  const registryAbi = contracts?.TapThatXRegistry?.abi;

  // Query registered chip using wagmi's useReadContract hook (handles IndexedDB errors gracefully)
  const { data: ownerChipData } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getOwnerChip",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!registryAddress && !!registryAbi,
    },
  });

  // Update registered chip address when data changes
  useEffect(() => {
    if (ownerChipData && ownerChipData !== "0x0000000000000000000000000000000000000000") {
      setRegisteredChipAddress(ownerChipData as string);
    } else {
      setRegisteredChipAddress("");
    }
  }, [ownerChipData]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && detectedChip) {
      setStatusMessage("");
      setFlowState("success");
      setStatusMessage("Success! Chip registered on-chain.");
      setRegisteredChipAddress(detectedChip);
    }
  }, [isConfirmed, detectedChip]);

  const handleRegister = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    if (!registryAddress || !registryAbi) {
      setStatusMessage("TapThatXRegistry not deployed on this network");
      setFlowState("error");
      return;
    }

    try {
      // Step 1: Read chip address
      setFlowState("reading");
      setStatusMessage("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;
      setDetectedChip(detectedChipAddress);

      setStatusMessage("");

      // Step 2: Sign registration with EIP-712
      await new Promise(resolve => setTimeout(resolve, 500));
      setFlowState("signing");
      setStatusMessage("Tap your chip again to authorize registration...");

      const registrationSig = await signTypedData({
        domain: {
          name: "TapThatXRegistry",
          version: "1",
          verifyingContract: registryAddress,
        },
        types: {
          ChipRegistration: [
            { name: "owner", type: "address" },
            { name: "chipAddress", type: "address" },
          ],
        },
        primaryType: "ChipRegistration",
        message: {
          owner: address,
          chipAddress: detectedChipAddress,
        },
      });

      setStatusMessage("");

      // Step 3: Send transaction
      await new Promise(resolve => setTimeout(resolve, 500));
      setFlowState("confirming");
      setStatusMessage("Please confirm the transaction in your wallet...");

      writeContract(
        {
          address: registryAddress,
          abi: registryAbi,
          functionName: "registerChip",
          args: [detectedChipAddress, registrationSig.signature as `0x${string}`],
        },
        {
          onError: err => {
            setFlowState("error");
            setStatusMessage(`Transaction failed: ${err.message}`);
          },
        },
      );
    } catch (err) {
      setFlowState("error");
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const resetFlow = () => {
    setFlowState("idle");
    setStatusMessage("");
    setDetectedChip("");
  };

  const allComplete = isConfirmed && flowState === "success";

  return (
    <div className="flex items-start justify-center p-4 sm:p-6 pb-24">
      <div className="w-full max-w-lg">
        {/* Main Glass Card */}
        <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="round-icon w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-4">
              <Nfc className="h-12 w-12 sm:h-14 sm:w-14" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">Register Your Chip</h1>

            {/* Registered Chip Pill */}
            {registeredChipAddress && (
              <div className="mt-3 flex justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-mono font-semibold text-success">
                    {registeredChipAddress.slice(0, 6)}...{registeredChipAddress.slice(-4)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-3 sm:space-y-4 md:space-y-5 flex flex-col min-h-[100px] sm:min-h-[140px]">
            {/* Step Indicator - Show when flow is active */}
            {flowState !== "idle" && flowState !== "error" && (
              <StepIndicator
                steps={REGISTRATION_STEPS}
                currentStep={
                  flowState === "reading"
                    ? 0
                    : flowState === "signing"
                      ? 1
                      : flowState === "confirming"
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
                <span className="text-sm font-semibold text-base-content">Connect your wallet to continue</span>
              </div>
            )}

            {/* Dynamic Status Display - showing loading and error states only */}
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

            {/* Current Flow State Indicator */}
            {flowState === "reading" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Chip detected</p>
              </div>
            )}

            {/* Step 2 Complete Indicator */}
            {flowState === "signing" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Authorization signed</p>
              </div>
            )}

            {/* Step 3 Complete Indicator - show when tx submitted but waiting for confirmation */}
            {flowState === "confirming" && !statusMessage && isTxPending && (
              <div className="text-center py-4 fade-in">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Submitting transaction...</p>
              </div>
            )}

            {/* Transaction submitted, waiting for confirmation */}
            {flowState === "confirming" && !statusMessage && !isTxPending && isConfirming && (
              <div className="text-center py-4 fade-in">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Waiting for confirmation...</p>
              </div>
            )}
          </div>

          {/* Action Button - Fixed position */}
          <div className="mt-4 sm:mt-6 space-y-4">
            {allComplete ? (
              <button onClick={resetFlow} className="glass-btn flex items-center justify-center gap-3 w-full">
                <Nfc className="h-6 w-6" />
                <span>Register Another Chip</span>
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={isLoading || isTxPending || isConfirming || !address}
                className="glass-btn flex items-center justify-center gap-3 w-full"
              >
                {isLoading || isTxPending || isConfirming ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>{isLoading ? "Scanning..." : isTxPending ? "Submitting..." : "Confirming..."}</span>
                  </>
                ) : (
                  <>
                    <Nfc className="h-6 w-6" />
                    <span>Start Registration</span>
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
