"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Nfc, Wallet } from "lucide-react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { StepIndicator } from "~~/components/StepIndicator";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import { ChipAddressDisplay } from "~~/components/register/ChipAddressDisplay";
import { Separator } from "~~/components/ui/separator";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

type FlowState = "idle" | "reading" | "signing" | "confirming" | "success" | "error";

const REGISTRATION_STEPS = [
  { label: "Detect Chip", description: "Hold device near NFC chip", timeEstimate: "2-3 sec" },
  { label: "Sign Authorization", description: "Tap chip again to authorize", timeEstimate: "2-3 sec" },
  { label: "Confirm Transaction", description: "Confirm in your wallet", timeEstimate: "5-10 sec" },
];

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, isSuccess: isTxSuccess } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, signTypedData, isLoading } = useHaloChip();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [chipAddress, setChipAddress] = useState<string>("");
  const [flowState, setFlowState] = useState<FlowState>("idle");

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const registryAddress = contracts?.TapThatXRegistry?.address;
  const registryAbi = contracts?.TapThatXRegistry?.abi;

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

      setChipAddress(detectedChipAddress);
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
          onSuccess: () => {
            setFlowState("success");
            setStatusMessage("Success! Chip registered on-chain.");
          },
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
    setChipAddress("");
  };

  const allComplete = isTxSuccess && flowState === "success";

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
            <p className="text-sm sm:text-base text-base-content/80 font-medium px-4">
              Link your NFC chip to your wallet on-chain
            </p>
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
                      : flowState === "confirming" || flowState === "success"
                        ? 2
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

            {/* Dynamic Status Display */}
            {flowState !== "idle" && statusMessage && (
              <div className="text-center py-3 fade-in">
                <div className="flex items-center justify-center gap-2.5">
                  {flowState === "error" ? (
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-error flex-shrink-0" />
                  ) : flowState === "success" ? (
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success flex-shrink-0" />
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

            {/* Chip Address Display */}
            {chipAddress && (
              <div className="fade-in">
                <Separator />
                <ChipAddressDisplay address={chipAddress} />
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
                disabled={isLoading || isTxPending || !address}
                className="glass-btn flex items-center justify-center gap-3 w-full"
              >
                {isLoading || isTxPending ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>{isLoading ? "Scanning..." : "Confirming..."}</span>
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
