"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Nfc, Wallet } from "lucide-react";
import { encodePacked, keccak256 } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

type StepStatus = "idle" | "active" | "loading" | "complete" | "error";

interface Step {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
}

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, isSuccess: isTxSuccess, error: txError } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, isLoading, error } = useHaloChip();
  const [status, setStatus] = useState<string>("");
  const [chipAddress, setChipAddress] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: "Detect Chip", description: "Tap your NFC chip to read address", status: "idle" },
    { id: 2, title: "Sign Registration", description: "Tap again to authorize", status: "idle" },
    { id: 3, title: "Confirm Transaction", description: "Complete on-chain registration", status: "idle" },
  ]);

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const chipRegistryAddress = contracts?.ChipRegistry?.address;
  const chipRegistryAbi = contracts?.ChipRegistry?.abi;

  const updateStep = (stepId: number, status: StepStatus) => {
    setSteps(prev => prev.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  const handleRegister = async () => {
    if (!address) {
      setStatus("Please connect your wallet first");
      return;
    }

    if (!chipRegistryAddress || !chipRegistryAbi) {
      setStatus("ChipRegistry not deployed on this network");
      return;
    }

    try {
      // Step 1: Read chip address
      updateStep(1, "loading");
      setStatus("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;

      setChipAddress(detectedChipAddress);
      updateStep(1, "complete");
      setStatus(`Chip detected: ${detectedChipAddress.slice(0, 10)}...${detectedChipAddress.slice(-8)}`);

      // Step 2: Sign registration
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(2, "loading");
      setStatus("Tap your chip again to authorize registration...");

      const messageToSign = keccak256(encodePacked(["address", "address"], [address, detectedChipAddress]));
      const registrationSig = await signMessage({ digest: messageToSign });

      updateStep(2, "complete");
      setStatus("Authorization signed. Preparing transaction...");

      // Step 3: Send transaction
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(3, "loading");
      setStatus("Please confirm the transaction in your wallet...");

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
            setStatus(`Success! Chip registered on-chain.`);
          },
          onError: err => {
            updateStep(3, "error");
            setStatus(`Transaction failed: ${err.message}`);
          },
        },
      );
    } catch (err) {
      const currentStep = steps.findIndex(s => s.status === "loading");
      if (currentStep !== -1) {
        updateStep(currentStep + 1, "error");
      }
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case "loading":
        return <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />;
      case "complete":
        return <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />;
      case "error":
        return <AlertCircle className="h-6 w-6 text-error" aria-hidden="true" />;
      default:
        return (
          <div className="h-6 w-6 rounded-full border-2 border-base-300 flex items-center justify-center">
            <span className="text-sm font-medium text-base-content/60">{step.id}</span>
          </div>
        );
    }
  };

  const resetFlow = () => {
    setSteps([
      { id: 1, title: "Detect Chip", description: "Tap your NFC chip to read address", status: "idle" },
      { id: 2, title: "Sign Registration", description: "Tap again to authorize", status: "idle" },
      { id: 3, title: "Confirm Transaction", description: "Complete on-chain registration", status: "idle" },
    ]);
    setStatus("");
    setChipAddress("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Nfc className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Register Your Chip</h1>
          <p className="text-base-content/70 text-sm md:text-base">
            Link your NFC chip to your wallet address on-chain
          </p>
        </div>

        {/* Main Card */}
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body p-6 md:p-8">
            {/* Wallet Connection Alert */}
            {!address && (
              <div role="alert" aria-live="polite" className="alert alert-warning mb-6">
                <Wallet className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">Please connect your wallet to continue</span>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-4 mb-8" role="list" aria-label="Registration steps">
              {steps.map(step => (
                <div
                  key={step.id}
                  role="listitem"
                  className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                    step.status === "active" || step.status === "loading"
                      ? "bg-primary/5 border border-primary/20"
                      : step.status === "complete"
                        ? "bg-success/5 border border-success/20"
                        : step.status === "error"
                          ? "bg-error/5 border border-error/20"
                          : "bg-base-200/50"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">{getStepIcon(step)}</div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-semibold text-sm md:text-base ${
                        step.status === "loading" ? "text-primary" : ""
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs md:text-sm text-base-content/60 mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Message */}
            {status && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`alert mb-6 ${
                  error || txError
                    ? "alert-error"
                    : isTxSuccess
                      ? "alert-success"
                      : isLoading || isTxPending
                        ? "alert-info"
                        : "alert-info"
                }`}
              >
                {error || txError ? (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                ) : isTxSuccess ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Info className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm break-words">{status}</span>
              </div>
            )}

            {/* Chip Address Display */}
            {chipAddress && (
              <div className="bg-base-200 rounded-lg p-4 mb-6">
                <p className="text-xs text-base-content/60 mb-1">Chip Address</p>
                <p className="font-mono text-xs md:text-sm break-all">{chipAddress}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {isTxSuccess ? (
                <button
                  onClick={resetFlow}
                  className="btn btn-primary w-full h-14 text-base"
                  aria-label="Register another chip"
                >
                  Register Another Chip
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={isLoading || isTxPending || !address}
                  className="btn btn-primary w-full h-14 text-base"
                  aria-label={
                    isLoading ? "Scanning NFC chip" : isTxPending ? "Processing transaction" : "Start registration"
                  }
                  aria-busy={isLoading || isTxPending}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      <span>Scanning Chip...</span>
                    </>
                  ) : isTxPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <Nfc className="h-5 w-5" aria-hidden="true" />
                      <span>Start Registration</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-base-content/50 text-center mt-4">
              Make sure NFC is enabled on your device and hold it close to the chip
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
