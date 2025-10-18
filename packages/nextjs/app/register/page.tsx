"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Nfc, Wallet } from "lucide-react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { ChipAddressDisplay } from "~~/components/register/ChipAddressDisplay";
import { RegistrationStep } from "~~/components/register/RegistrationStep";
import { REGISTRATION_STEPS, type RegistrationStep as Step } from "~~/components/register/types";
import { Separator } from "~~/components/ui/separator";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, isSuccess: isTxSuccess } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, signTypedData, isLoading, error } = useHaloChip();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [chipAddress, setChipAddress] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>(REGISTRATION_STEPS.map(step => ({ ...step, status: "idle" })));

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const registryAddress = contracts?.TapThatXRegistry?.address;
  const registryAbi = contracts?.TapThatXRegistry?.abi;

  const updateStep = (stepId: number, status: Step["status"]) => {
    setSteps(prev => prev.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  const handleRegister = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    if (!registryAddress || !registryAbi) {
      setStatusMessage("TapThatXRegistry not deployed on this network");
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

      // Step 2: Sign registration with EIP-712
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(2, "loading");
      setStatusMessage("Tap your chip again to authorize registration...");

      const registrationSig = await signTypedData({
        domain: {
          name: "TapThatXRegistry",
          version: "1",
          chainId,
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

      updateStep(2, "complete");
      setStatusMessage("");

      // Step 3: Send transaction
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(3, "loading");
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-200">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-primary mb-4 transition-transform hover:scale-105 border-4 border-primary">
            <Nfc className="h-14 w-14 text-primary-content" />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Register Your Chip</h1>
          <p className="text-base-content/80 font-medium">Link your NFC chip to your wallet on-chain</p>
        </div>

        {/* Main Card */}
        <div className="bg-base-100 rounded-xl border-2 border-base-300 p-6 space-y-4 transition-all hover:border-primary">
          {/* Wallet Alert */}
          {!address && (
            <div className="alert alert-warning border-2">
              <Wallet className="h-5 w-5" />
              <span className="text-sm font-semibold">Connect your wallet to continue</span>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className={`alert border-2 ${showError ? "alert-error" : "alert-info"}`}>
              {showError ? <AlertCircle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
              <span className="text-sm font-semibold">{statusMessage}</span>
            </div>
          )}

          {/* Steps List - Only show first 2 */}
          <div className="space-y-2">
            {steps.slice(0, 2).map(step => (
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

          {/* Action Button */}
          {allComplete ? (
            <button
              onClick={resetFlow}
              className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Register Another Chip
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={isLoading || isTxPending || !address}
              className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:hover:scale-100"
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

          {/* Help Text */}
          <p className="text-xs text-center text-base-content/50">
            Make sure NFC is enabled on your device and hold it close to the chip
          </p>
        </div>
      </div>
    </div>
  );
}
