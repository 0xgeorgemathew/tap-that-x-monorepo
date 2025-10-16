"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Nfc, Wallet } from "lucide-react";
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
      const registrationSig = await signMessage({ message: messageToSign.slice(2), format: "hex" });

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
        return (
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        );
      case "complete":
        return (
          <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          </div>
        );
      case "error":
        return (
          <div className="h-10 w-10 rounded-full bg-error/20 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-error" aria-hidden="true" />
          </div>
        );
      default:
        return (
          <div className="h-10 w-10 rounded-full bg-base-200 border-2 border-base-300 flex items-center justify-center">
            <span className="text-base font-bold text-base-content/60">{step.id}</span>
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg mb-6 animate-pulse-slow">
            <Nfc className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Register Your Chip
          </h1>
          <p className="text-base-content/70 text-base md:text-lg leading-relaxed">
            Link your NFC chip to your wallet address on-chain
          </p>
        </div>

        {/* Main Card */}
        <div className="card bg-base-100/80 backdrop-blur-sm shadow-2xl border border-base-300/50 overflow-hidden">
          <div className="card-body p-6 md:p-8">
            {/* Wallet Connection Alert */}
            {!address && (
              <div role="alert" aria-live="polite" className="alert alert-warning mb-8 shadow-md">
                <Wallet className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Please connect your wallet to continue</span>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3 mb-8 relative" role="list" aria-label="Registration steps">
              {/* Vertical connector line */}
              <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-base-300 via-base-300 to-transparent -z-10" />

              {steps.map(step => (
                <div key={step.id}>
                  <div
                    role="listitem"
                    className={`relative flex items-start gap-4 p-5 rounded-xl transition-all duration-300 ${
                      step.status === "active" || step.status === "loading"
                        ? "bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 shadow-lg scale-[1.02]"
                        : step.status === "complete"
                          ? "bg-gradient-to-br from-success/10 to-success/5 border-2 border-success/30"
                          : step.status === "error"
                            ? "bg-gradient-to-br from-error/10 to-error/5 border-2 border-error/30"
                            : "bg-base-200/40 border border-base-300/50"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 relative z-10">{getStepIcon(step)}</div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-bold text-base md:text-lg mb-1 ${
                          step.status === "loading" ? "text-primary" : ""
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p className="text-xs md:text-sm text-base-content/60">{step.description}</p>

                      {/* Status message within active step */}
                      {step.status === "loading" && status && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-primary font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>{status}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Global Status Message for errors/success */}
            {(error || txError || isTxSuccess) && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`alert mb-6 shadow-md ${error || txError ? "alert-error" : "alert-success"}`}
              >
                {error || txError ? (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm break-words font-medium">{status}</span>
              </div>
            )}

            {/* Chip Address Display */}
            {chipAddress && (
              <div className="bg-gradient-to-br from-base-200 to-base-300/50 rounded-xl p-5 mb-6 border border-base-300/50 shadow-md">
                <p className="text-xs font-semibold text-base-content/70 mb-2 uppercase tracking-wide">Chip Address</p>
                <p className="font-mono text-sm md:text-base break-all text-base-content/90 leading-relaxed">
                  {chipAddress}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {isTxSuccess ? (
                <button
                  onClick={resetFlow}
                  className="btn btn-primary w-full h-16 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                  aria-label="Register another chip"
                >
                  Register Another Chip
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={isLoading || isTxPending || !address}
                  className="btn btn-primary w-full h-16 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={
                    isLoading ? "Scanning NFC chip" : isTxPending ? "Processing transaction" : "Start registration"
                  }
                  aria-busy={isLoading || isTxPending}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Scanning Chip...</span>
                    </>
                  ) : isTxPending ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <Nfc className="h-6 w-6" aria-hidden="true" />
                      <span>Start Registration</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-base-content/50 text-center mt-5 leading-relaxed">
              Make sure NFC is enabled on your device and hold it close to the chip
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
