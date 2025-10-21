"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Wallet, Zap } from "lucide-react";
import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { StepIndicator } from "~~/components/StepIndicator";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import { ChipOwnerDisplay } from "~~/components/payment/ChipOwnerDisplay";
import { Separator } from "~~/components/ui/separator";
import deployedContracts from "~~/contracts/deployedContracts";
import { useGaslessRelay } from "~~/hooks/useGaslessRelay";
import { useHaloChip } from "~~/hooks/useHaloChip";

type FlowState = "idle" | "detecting" | "authorizing" | "success" | "error";

const PAYMENT_STEPS = [
  { label: "Detect & Verify", description: "Verifying chip ownership", timeEstimate: "2-3 sec" },
  { label: "Authorize Payment", description: "Tap chip to authorize", timeEstimate: "2-3 sec" },
  { label: "Process Transaction", description: "Relaying to blockchain", timeEstimate: "10-15 sec" },
];

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
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  const { signMessage, signTypedData, isLoading } = useHaloChip();
  const { relayPayment } = useGaslessRelay();

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
        console.error("Failed to check allowance/balance:", err);
      } finally {
        setCheckingApproval(false);
      }
    };

    checkAllowance();
  }, [address, publicClient, USDC, PROTOCOL_ADDRESS, contracts]);

  const handlePayment = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    // Network validation - check contracts are deployed
    if (!contracts || !PROTOCOL_ADDRESS || !USDC || !REGISTRY_ADDRESS) {
      setStatusMessage(`Contracts not deployed on this network (chain ${chainId}). Please switch networks.`);
      setFlowState("error");
      return;
    }

    try {
      // Step 1: Detect chip and get owner
      setFlowState("detecting");
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
        setFlowState("error");
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

      // Get USDCTapPayment contract address (this is where USDC will be sent)
      const PAYMENT_CONTRACT = contracts.USDCTapPayment.address;
      setRecipient(PAYMENT_CONTRACT);
      setStatusMessage("");

      // Step 2: Tap chip to authorize payment
      await new Promise(resolve => setTimeout(resolve, 500));
      setFlowState("authorizing");
      setStatusMessage("Tap your chip again to authorize payment...");

      const amountWei = parseUnits(amount, 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      // Build USDC transfer calldata - sending to USDCTapPayment contract
      const transferCallData = `0x${(
        "23b872dd" + // transferFrom selector
        address.slice(2).padStart(64, "0") + // from
        PAYMENT_CONTRACT.slice(2).padStart(64, "0") + // to (USDCTapPayment contract)
        amountWei.toString(16).padStart(64, "0")
      ) // amount
        .toLowerCase()}` as `0x${string}`;

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
          target: USDC,
          callData: transferCallData,
          value: BigInt(0),
          timestamp: BigInt(timestamp),
          nonce,
        },
      });

      setStatusMessage("Processing payment on blockchain...");

      await relayPayment({
        owner: address,
        transferCallData,
        chipSignature: chipSig.signature,
        timestamp,
        nonce,
      });

      setFlowState("success");
      setStatusMessage(`Success! Payment of ${amount} USDC sent.`);
    } catch (err) {
      console.error("Payment failed:", err);
      setFlowState("error");
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Payment failed"}`);
    }
  };

  const resetFlow = () => {
    setFlowState("idle");
    setStatusMessage("");
    setChipAddress("");
    setRecipient("");
    setAmount("1");
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
              <CreditCard className="h-12 w-12 sm:h-14 sm:w-14" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">Tap to Pay</h1>
            <p className="text-sm sm:text-base text-base-content/80 font-medium px-4">
              Send USDC by tapping your NFC chip
            </p>
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-3 sm:space-y-4 md:space-y-5 flex flex-col min-h-[100px] sm:min-h-[140px]">
            {/* Step Indicator - Show when flow is active */}
            {flowState !== "idle" && flowState !== "error" && (
              <StepIndicator
                steps={PAYMENT_STEPS}
                currentStep={
                  flowState === "detecting" ? 0 : flowState === "authorizing" ? 1 : flowState === "success" ? 2 : 0
                }
              />
            )}

            {/* Wallet Alert */}
            {!address && (
              <div className="glass-alert">
                <Wallet className="h-5 w-5 text-warning" />
                <span className="text-sm font-semibold text-base-content">Connect your wallet to make payments</span>
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

            {/* Approval Alert - Subtle inline */}
            {address && contracts && !checkingApproval && allowance !== null && allowance < parseUnits(amount, 6) && (
              <div className="text-center">
                <a href="/approve" className="inline-warning hover:opacity-80 transition-opacity">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span>{allowance === 0n ? "USDC approval required" : "Insufficient allowance"}</span>
                  <span className="text-xs opacity-75">→</span>
                </a>
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

            {/* Gasless Badge - show on idle and success */}
            {(flowState === "idle" || flowState === "success") && (
              <div className="flex items-center justify-center gap-2 text-sm text-base-content/70 fade-in">
                <Zap className="h-4 w-4 text-primary" />
                <span>No wallet popup needed</span>
              </div>
            )}

            {/* Current Flow State Indicator */}
            {flowState === "detecting" && !statusMessage && (
              <div className="text-center py-4 fade-in">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-lg font-semibold text-base-content">Chip detected</p>
              </div>
            )}

            {/* Chip Owner Display */}
            {chipAddress && recipient && (
              <div className="fade-in">
                <Separator />
                <ChipOwnerDisplay chipAddress={chipAddress} ownerAddress={recipient} />
              </div>
            )}
          </div>

          {/* Action Button - Fixed position */}
          <div className="mt-4 sm:mt-6 space-y-4">
            {allComplete ? (
              <button onClick={resetFlow} className="glass-btn flex items-center justify-center gap-3 w-full">
                <CreditCard className="h-6 w-6" />
                <span>Make Another Payment</span>
              </button>
            ) : (
              <button
                onClick={handlePayment}
                disabled={
                  isLoading ||
                  !address ||
                  !contracts ||
                  allowance === null ||
                  allowance < parseUnits(amount, 6) ||
                  checkingApproval
                }
                className="glass-btn flex items-center justify-center gap-3 w-full"
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
          </div>
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
