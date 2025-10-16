"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Nfc, Wallet } from "lucide-react";
import { encodePacked, keccak256 } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { ChipAddressDisplay } from "~~/components/register/ChipAddressDisplay";
import { RegistrationStep } from "~~/components/register/RegistrationStep";
import { StepIndicator } from "~~/components/register/StepIndicator";
import { REGISTRATION_STEPS, type RegistrationStep as Step } from "~~/components/register/types";
import { Separator } from "~~/components/ui/separator";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, isSuccess: isTxSuccess } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, isLoading, error } = useHaloChip();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [chipAddress, setChipAddress] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>(REGISTRATION_STEPS.map(step => ({ ...step, status: "idle" })));

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const chipRegistryAddress = contracts?.ChipRegistry?.address;
  const chipRegistryAbi = contracts?.ChipRegistry?.abi;

  const updateStep = (stepId: number, status: Step["status"]) => {
    setSteps(prev => prev.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  const getCurrentStepNumber = () => {
    const activeIndex = steps.findIndex(s => s.status === "loading" || s.status === "active");
    return activeIndex >= 0 ? activeIndex + 1 : steps.filter(s => s.status === "complete").length + 1;
  };

  const handleRegister = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    if (!chipRegistryAddress || !chipRegistryAbi) {
      setStatusMessage("ChipRegistry not deployed on this network");
      return;
    }

    try {
      // Step 1: Read chip address
      updateStep(1, "loading");
      setStatusMessage("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;

      setChipAddress(detectedChipAddress);
      updateStep(1, "complete");
      setStatusMessage("");

      // Step 2: Sign registration
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(2, "loading");
      setStatusMessage("Tap your chip again to authorize registration...");

      const messageToSign = keccak256(encodePacked(["address", "address"], [address, detectedChipAddress]));
      const registrationSig = await signMessage({ message: messageToSign.slice(2), format: "hex" });

      updateStep(2, "complete");
      setStatusMessage("");

      // Step 3: Send transaction
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(3, "loading");
      setStatusMessage("Please confirm the transaction in your wallet...");

      writeContract(
        {
          address: chipRegistryAddress,
          abi: chipRegistryAbi,
          functionName: "registerChip",
          args: [detectedChipAddress, registrationSig.signature as `0x${string}`],
        },
        {
          onSuccess: () => {
            updateStep(3, "complete");
            setStatusMessage("Success! Chip registered on-chain.");
          },
          onError: err => {
            updateStep(3, "error");
            setStatusMessage(`Transaction failed: ${err.message}`);
          },
        },
      );
    } catch (err) {
      const currentStep = steps.findIndex(s => s.status === "loading");
      if (currentStep !== -1) {
        updateStep(currentStep + 1, "error");
      }
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const resetFlow = () => {
    setSteps(REGISTRATION_STEPS.map(step => ({ ...step, status: "idle" })));
    setStatusMessage("");
    setChipAddress("");
  };

  const showError = error || steps.some(s => s.status === "error");
  const allComplete = isTxSuccess && steps.every(s => s.status === "complete");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-base-200 to-base-300">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 transition-transform hover:scale-105">
            <Nfc className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Register Your Chip</h1>
          <p className="text-base-content/60">Link your NFC chip to your wallet on-chain</p>
        </div>

        {/* Main Card */}
        <div className="bg-base-100 rounded-xl shadow-xl border border-base-300 p-6 space-y-6 transition-shadow hover:shadow-2xl">
          {/* Wallet Alert */}
          {!address && (
            <div className="alert alert-warning shadow-md">
              <Wallet className="h-5 w-5" />
              <span className="text-sm">Connect your wallet to continue</span>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className={`alert shadow-md ${showError ? "alert-error" : "alert-info"}`}>
              {showError ? <AlertCircle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
              <span className="text-sm">{statusMessage}</span>
            </div>
          )}

          {/* Progress Indicator */}
          <StepIndicator steps={steps} currentStep={getCurrentStepNumber()} />

          <Separator />

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map(step => (
              <RegistrationStep key={step.id} step={step} />
            ))}
          </div>

          {/* Chip Address Display */}
          {chipAddress && (
            <>
              <Separator />
              <ChipAddressDisplay address={chipAddress} />
            </>
          )}

          <Separator />

          {/* Action Button */}
          {allComplete ? (
            <button
              onClick={resetFlow}
              className="btn btn-primary w-full h-12 hover:scale-[1.01] active:scale-[0.99] transition-transform"
            >
              Register Another Chip
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={isLoading || isTxPending || !address}
              className="btn btn-primary w-full h-12 hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:hover:scale-100"
            >
              {isLoading || isTxPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isLoading ? "Scanning..." : "Confirming..."}</span>
                </>
              ) : (
                <>
                  <Nfc className="h-5 w-5" />
                  <span>Start Registration</span>
                </>
              )}
            </button>
          )}

          {/* Help Text */}
          <p className="text-xs text-center text-base-content/50">
            Make sure NFC is enabled on your device and hold it close to the chip
          </p>
        </div>
      </div>
    </div>
  );
}
