"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CreditCard, Loader2, Wallet } from "lucide-react";
import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { ChipOwnerDisplay } from "~~/components/payment/ChipOwnerDisplay";
import { PaymentStep } from "~~/components/payment/PaymentStep";
import { PAYMENT_STEPS, type PaymentStep as Step } from "~~/components/payment/types";
import { Separator } from "~~/components/ui/separator";
import deployedContracts from "~~/contracts/deployedContracts";
import { useGaslessRelay } from "~~/hooks/useGaslessRelay";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function PaymentPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const PROTOCOL_ADDRESS = contracts?.TapThatXProtocol?.address;
  const USDC = contracts?.MockUSDC?.address;
  const REGISTRY_ADDRESS = contracts?.TapThatXRegistry?.address;

  const [chipAddress, setChipAddress] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>(PAYMENT_STEPS.map(step => ({ ...step, status: "idle" })));
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  const { signMessage, signTypedData, isLoading, error } = useHaloChip();
  const { relayPayment } = useGaslessRelay();

  const updateStep = (stepId: number, status: Step["status"]) => {
    setSteps(prev => prev.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  // Check USDC allowance on mount
  useEffect(() => {
    const checkAllowance = async () => {
      if (!address || !publicClient || !USDC || !PROTOCOL_ADDRESS) {
        setCheckingApproval(false);
        return;
      }

      try {
        const currentAllowance = (await publicClient.readContract({
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "allowance",
          args: [address, PROTOCOL_ADDRESS],
        })) as bigint;

        setAllowance(currentAllowance);
      } catch (err) {
        console.error("Failed to check allowance:", err);
      } finally {
        setCheckingApproval(false);
      }
    };

    checkAllowance();
  }, [address, publicClient, USDC, PROTOCOL_ADDRESS, contracts]);

  const handlePayment = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    // Network validation - check contracts are deployed
    if (!contracts || !PROTOCOL_ADDRESS || !USDC || !REGISTRY_ADDRESS) {
      setStatusMessage(`Contracts not deployed on this network (chain ${chainId}). Please switch networks.`);
      return;
    }

    try {
      // Step 1: Detect chip and get owner
      updateStep(1, "loading");
      setStatusMessage("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;
      setChipAddress(detectedChipAddress);

      // Query TapThatXRegistry for owner
      if (!contracts || !REGISTRY_ADDRESS) {
        throw new Error("Contracts not available");
      }
      const chipOwner = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "getOwner",
        args: [detectedChipAddress],
      })) as `0x${string}`;

      if (!chipOwner || chipOwner === "0x0000000000000000000000000000000000000000") {
        updateStep(1, "error");
        setStatusMessage(
          `Error: Chip not registered (${detectedChipAddress.slice(0, 10)}...). Please register the chip first at /register page.`,
        );
        console.error("Chip not registered:", {
          detectedChipAddress,
          chipOwner,
          registryAddress: REGISTRY_ADDRESS,
        });
        return;
      }

      console.log("✅ Chip registered:", {
        chipAddress: detectedChipAddress,
        owner: chipOwner,
      });

      setRecipient(chipOwner);
      updateStep(1, "complete");
      setStatusMessage("");

      // Step 2: Tap chip to authorize payment
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(2, "loading");
      setStatusMessage("Tap your chip again to authorize payment...");

      const amountWei = parseUnits(amount, 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      // Build USDC transfer calldata
      const transferCallData = `0x${(
        "23b872dd" + // transferFrom selector
        address.slice(2).padStart(64, "0") + // from
        chipOwner.slice(2).padStart(64, "0") + // to
        amountWei.toString(16).padStart(64, "0")
      ) // amount
        .toLowerCase()}` as `0x${string}`;

      const chipSig = await signTypedData({
        domain: {
          name: "TapThatXProtocol",
          version: "1",
          chainId,
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
          target: USDC,
          callData: transferCallData,
          value: BigInt(0),
          timestamp: BigInt(timestamp),
          nonce,
        },
      });

      updateStep(2, "complete");
      setStatusMessage("Processing payment on blockchain...");

      await relayPayment({
        owner: address,
        recipient: chipOwner,
        amount: amountWei.toString(),
        chipSignature: chipSig.signature,
        timestamp,
        nonce,
      });
      setStatusMessage(`Success! Payment of ${amount} USDC sent.`);
    } catch (err) {
      console.error("Payment failed:", err);
      const currentStep = steps.findIndex(s => s.status === "loading");
      if (currentStep !== -1) {
        updateStep(currentStep + 1, "error");
      }
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Payment failed"}`);
    }
  };

  const resetFlow = () => {
    setSteps(PAYMENT_STEPS.map(step => ({ ...step, status: "idle" })));
    setStatusMessage("");
    setChipAddress("");
    setRecipient("");
    setAmount("1");
  };

  const showError = error || steps.some(s => s.status === "error");
  const allComplete = steps.every(s => s.status === "complete");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-200">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-primary mb-4 transition-transform hover:scale-105 border-4 border-primary">
            <CreditCard className="h-14 w-14 text-primary-content" />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Tap to Pay</h1>
          <p className="text-base-content/80 font-medium">Send USDC by tapping your NFC chip</p>
        </div>

        {/* Main Card */}
        <div className="bg-base-100 rounded-xl border-2 border-base-300 p-6 space-y-4 transition-all hover:border-primary">
          {/* Wallet Alert */}
          {!address && (
            <div className="alert alert-warning border-2">
              <Wallet className="h-5 w-5" />
              <span className="text-sm font-semibold">Connect your wallet to make payments</span>
            </div>
          )}

          {/* Network Alert */}
          {address && !contracts && (
            <div className="alert alert-warning border-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">
                Contracts not deployed on this network. Please switch networks.
              </span>
            </div>
          )}

          {/* Approval Alert */}
          {address && contracts && !checkingApproval && allowance !== null && allowance < parseUnits(amount, 6) && (
            <div className="alert alert-warning border-2">
              <AlertCircle className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold">
                  {allowance === 0n ? "USDC approval required" : "Insufficient USDC allowance"}
                </span>
                <a href="/approve" className="text-xs underline hover:text-primary">
                  Go to approval page →
                </a>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`alert border-2 ${showError ? "alert-error" : allComplete ? "alert-success" : "alert-info"}`}
            >
              {showError ? (
                <AlertCircle className="h-5 w-5" />
              ) : allComplete ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <span className="text-sm font-semibold">{statusMessage}</span>
            </div>
          )}

          {/* Steps List - Only show first 2 */}
          <div className="space-y-2">
            {steps.slice(0, 2).map(step => (
              <PaymentStep key={step.id} step={step} />
            ))}
          </div>

          {/* Chip Owner Display */}
          {chipAddress && recipient && (
            <>
              <Separator />
              <ChipOwnerDisplay chipAddress={chipAddress} ownerAddress={recipient} />
            </>
          )}

          {/* Action Button */}
          {allComplete ? (
            <button
              onClick={resetFlow}
              className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Make Another Payment
            </button>
          ) : (
            <button
              onClick={handlePayment}
              disabled={
                isLoading ||
                !address ||
                !contracts ||
                !allowance ||
                allowance < parseUnits(amount, 6) ||
                checkingApproval
              }
              className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-6 w-6" />
                  <span>Pay {amount} USDC</span>
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
