"use client";

import { useState } from "react";
import { AlertCircle, CreditCard, Loader2, Wallet } from "lucide-react";
import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useSignTypedData } from "wagmi";
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

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const PAYMENT_PROCESSOR = contracts?.USDCPaymentProcessor?.address;
  const USDC = contracts?.MockUSDC?.address;
  const CHIP_REGISTRY = contracts?.ChipRegistry?.address;

  const [chipAddress, setChipAddress] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>(PAYMENT_STEPS.map(step => ({ ...step, status: "idle" })));

  const { signMessage, signTypedData, isLoading, error } = useHaloChip();
  const { signTypedDataAsync } = useSignTypedData();
  const { relayPayment } = useGaslessRelay();

  const updateStep = (stepId: number, status: Step["status"]) => {
    setSteps(prev => prev.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  const handlePayment = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    if (!PAYMENT_PROCESSOR || !USDC || !CHIP_REGISTRY) {
      setStatusMessage("Contracts not deployed on this network");
      return;
    }

    try {
      // Step 1: Detect chip and get owner
      updateStep(1, "loading");
      setStatusMessage("Hold your device near the NFC chip...");

      const chipData = await signMessage({ message: "init", format: "text" });
      const detectedChipAddress = chipData.address as `0x${string}`;
      setChipAddress(detectedChipAddress);

      // Query ChipRegistry for owner
      const chipOwner = (await publicClient.readContract({
        address: CHIP_REGISTRY,
        abi: contracts.ChipRegistry.abi,
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
          registryAddress: CHIP_REGISTRY,
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

      const chipSig = await signTypedData({
        domain: {
          name: "USDCPaymentProcessor",
          version: "1",
          chainId,
          verifyingContract: PAYMENT_PROCESSOR,
        },
        types: {
          PaymentAuth: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "PaymentAuth",
        message: {
          from: address,
          to: chipOwner,
          amount: amountWei,
          timestamp: BigInt(timestamp),
          nonce,
        },
      });

      updateStep(2, "complete");
      setStatusMessage("");

      // Step 3: Sign USDC permit
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(3, "loading");
      setStatusMessage("Please sign USDC permit in your wallet...");

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const permitNonce = await publicClient.readContract({
        address: USDC,
        abi: contracts.MockUSDC.abi,
        functionName: "nonces",
        args: [address],
      });

      const permitSig = await signTypedDataAsync({
        domain: {
          name: "USD Coin",
          version: "1",
          chainId,
          verifyingContract: USDC,
        },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        message: {
          owner: address,
          spender: PAYMENT_PROCESSOR,
          value: amountWei,
          nonce: permitNonce as bigint,
          deadline: BigInt(deadline),
        },
      });

      const r = permitSig.slice(0, 66) as `0x${string}`;
      const s = ("0x" + permitSig.slice(66, 130)) as `0x${string}`;
      const v = parseInt(permitSig.slice(130, 132), 16);

      updateStep(3, "complete");
      setStatusMessage("");

      // Step 4: Relay transaction
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStep(4, "loading");
      setStatusMessage("Processing payment on blockchain...");

      await relayPayment({
        owner: address,
        recipient: chipOwner,
        amount: amountWei.toString(),
        deadline,
        permitSignature: { v, r, s },
        chipSignature: chipSig.signature,
        timestamp,
        nonce,
      });

      updateStep(4, "complete");
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-base-200 to-base-300">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary mb-4 transition-transform hover:scale-105 shadow-xl">
            <CreditCard className="h-14 w-14 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Tap to Pay</h1>
          <p className="text-base-content/60">Send USDC by tapping your NFC chip</p>
        </div>

        {/* Main Card */}
        <div className="bg-base-100 rounded-xl shadow-xl border border-base-300 p-6 space-y-4 transition-shadow hover:shadow-2xl">
          {/* Wallet Alert */}
          {!address && (
            <div className="alert alert-warning shadow-md">
              <Wallet className="h-5 w-5" />
              <span className="text-sm">Connect your wallet to make payments</span>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`alert shadow-md ${showError ? "alert-error" : allComplete ? "alert-success" : "alert-info"}`}
            >
              {showError ? (
                <AlertCircle className="h-5 w-5" />
              ) : allComplete ? (
                <CreditCard className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <span className="text-sm">{statusMessage}</span>
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
              className="btn btn-primary w-full h-16 rounded-full text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
            >
              Make Another Payment
            </button>
          ) : (
            <button
              onClick={handlePayment}
              disabled={isLoading || !address}
              className="btn btn-primary w-full h-16 rounded-full text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:hover:scale-100 shadow-lg"
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
