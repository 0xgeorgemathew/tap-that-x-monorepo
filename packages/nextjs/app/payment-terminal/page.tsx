"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, DollarSign, Loader2, Nfc, Shield, User } from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import { ChipOwnerDisplay } from "~~/components/payment/ChipOwnerDisplay";
import { PaymentStep } from "~~/components/payment/PaymentStep";
import { PaymentStepIndicator } from "~~/components/payment/PaymentStepIndicator";
import { PaymentStep as PaymentStepType } from "~~/components/payment/types";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";
import { usePaymentTerminal } from "~~/hooks/usePaymentTerminal";

type FlowState = "idle" | "merchant-tapping" | "customer-tapping" | "processing" | "success" | "error" | "approving";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export default function PaymentTerminalPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const TERMINAL_ADDRESS = contracts?.TapThatXPaymentTerminal?.address;
  const REGISTRY_ADDRESS = contracts?.TapThatXRegistry?.address;

  // Hard-coded PYUSD addresses per chain
  const PYUSD_ADDRESS =
    chainId === 11155111
      ? "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" // PYUSD on Sepolia
      : contracts?.MockUSDC?.address; // MockUSDC on Base Sepolia

  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [amount, setAmount] = useState("");
  const [allowance, setAllowance] = useState<bigint>(0n);

  // Merchant state (Step 1)
  const [merchantAddress, setMerchantAddress] = useState<string>("");
  const [merchantChipAddress, setMerchantChipAddress] = useState<string>("");

  // Transaction result
  const [txHash, setTxHash] = useState<string>("");

  const { signMessage } = useHaloChip();
  const { executePayment } = usePaymentTerminal(TERMINAL_ADDRESS as `0x${string}`);
  const { writeContract } = useWriteContract();

  // Payment steps for UI
  const [steps, setSteps] = useState<PaymentStepType[]>([
    {
      id: 1,
      title: "Merchant Setup",
      description: "Enter amount and tap merchant chip",
      status: "active",
    },
    {
      id: 2,
      title: "Customer Payment",
      description: "Customer taps chip to authorize payment",
      status: "idle",
    },
  ]);

  const updateStepStatus = (stepId: number, status: PaymentStepType["status"]) => {
    setSteps(prevSteps => prevSteps.map(step => (step.id === stepId ? { ...step, status } : step)));
  };

  /**
   * Check current PYUSD allowance
   */
  const checkAllowance = useCallback(async () => {
    if (!address || !PYUSD_ADDRESS || !TERMINAL_ADDRESS || !publicClient) return;

    try {
      const currentAllowance = (await publicClient.readContract({
        address: PYUSD_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, TERMINAL_ADDRESS],
      })) as bigint;

      setAllowance(currentAllowance);
    } catch (error) {
      console.error("Error checking allowance:", error);
    }
  }, [address, PYUSD_ADDRESS, TERMINAL_ADDRESS, publicClient]);

  // Check allowance on mount and when address/step changes
  useEffect(() => {
    if (currentStep === 2 && address) {
      checkAllowance();
    }
  }, [currentStep, address, checkAllowance]);

  /**
   * Approve PYUSD spending for payment terminal
   */
  const handleApprovePYUSD = async () => {
    if (!address || !PYUSD_ADDRESS || !TERMINAL_ADDRESS) return;

    try {
      setFlowState("approving");
      setStatusMessage("Approving PYUSD spending...");

      writeContract(
        {
          address: PYUSD_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [TERMINAL_ADDRESS as `0x${string}`, maxUint256],
        },
        {
          onSuccess: async () => {
            setStatusMessage("PYUSD approved! You can now accept payments.");
            setFlowState("idle");
            await checkAllowance();
            setTimeout(() => setStatusMessage(""), 3000);
          },
          onError: error => {
            console.error("Approval error:", error);
            setStatusMessage("Approval failed. Please try again.");
            setFlowState("error");
          },
        },
      );
    } catch (error) {
      console.error("Approval error:", error);
      setStatusMessage(error instanceof Error ? error.message : "Approval failed");
      setFlowState("error");
    }
  };

  /**
   * Step 1: Merchant enters amount and taps chip
   */
  const handleMerchantTap = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    if (!contracts || !TERMINAL_ADDRESS || !REGISTRY_ADDRESS || !PYUSD_ADDRESS) {
      setStatusMessage(`Payment terminal not deployed on this network (chain ${chainId})`);
      setFlowState("error");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setStatusMessage("Please enter a valid amount");
      setFlowState("error");
      return;
    }

    try {
      setFlowState("merchant-tapping");
      setStatusMessage("Merchant: Tap your NFC chip...");
      updateStepStatus(1, "loading");

      // Detect merchant chip
      const merchantChipData = await signMessage({ message: "init", format: "text" });
      const merchantChip = merchantChipData.address as `0x${string}`;

      // Validate merchant chip is registered
      const merchantHasChip = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "hasChip",
        args: [address, merchantChip],
      })) as boolean;

      if (!merchantHasChip) {
        setFlowState("error");
        setStatusMessage(`Merchant chip not registered (${merchantChip.slice(0, 10)}...). Register at /register.`);
        updateStepStatus(1, "error");
        return;
      }

      // Store merchant data and move to step 2
      setMerchantAddress(address);
      setMerchantChipAddress(merchantChip);
      setCurrentStep(2);
      setFlowState("idle");
      setStatusMessage("");
      updateStepStatus(1, "complete");
      updateStepStatus(2, "active");

      // Check allowance for customer
      await checkAllowance();
    } catch (error) {
      console.error("Merchant tap error:", error);
      setFlowState("error");
      setStatusMessage(error instanceof Error ? error.message : "Failed to detect merchant chip");
      updateStepStatus(1, "error");
    }
  };

  /**
   * Step 2: Customer taps chip to authorize payment
   */
  const handleCustomerTap = async () => {
    if (!address || !publicClient) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    if (!contracts || !TERMINAL_ADDRESS || !REGISTRY_ADDRESS || !PYUSD_ADDRESS) {
      setStatusMessage(`Payment terminal not deployed on this network`);
      setFlowState("error");
      return;
    }

    try {
      setFlowState("customer-tapping");
      setStatusMessage("Customer: Tap your NFC chip...");
      updateStepStatus(2, "loading");

      // Detect customer chip
      const customerChipData = await signMessage({ message: "init", format: "text" });
      const customerChip = customerChipData.address as `0x${string}`;

      // Validate customer chip is registered
      const customerHasChip = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "hasChip",
        args: [address, customerChip],
      })) as boolean;

      if (!customerHasChip) {
        setFlowState("error");
        setStatusMessage(`Customer chip not registered (${customerChip.slice(0, 10)}...). Register at /register.`);
        updateStepStatus(2, "error");
        return;
      }

      // Check customer PYUSD balance
      const customerBalance = (await publicClient.readContract({
        address: PYUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      const amountWei = parseUnits(amount, 6); // PYUSD has 6 decimals

      if (customerBalance < amountWei) {
        setFlowState("error");
        setStatusMessage(
          `Insufficient PYUSD balance. Need ${amount} PYUSD, have ${formatUnits(customerBalance, 6)} PYUSD`,
        );
        updateStepStatus(2, "error");
        return;
      }

      // Check customer approval
      const customerAllowance = (await publicClient.readContract({
        address: PYUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, TERMINAL_ADDRESS],
      })) as bigint;

      if (customerAllowance < amountWei) {
        setFlowState("error");
        setStatusMessage("Customer has not approved PYUSD spending. Please approve at /approve.");
        updateStepStatus(2, "error");
        return;
      }

      // Execute payment via relay
      setFlowState("processing");
      setStatusMessage("Processing payment on blockchain...");

      const result = await executePayment({
        payerAddress: address,
        payerChipAddress: customerChip,
        payeeAddress: merchantAddress as `0x${string}`,
        payeeChipAddress: merchantChipAddress as `0x${string}`,
        tokenAddress: PYUSD_ADDRESS,
        amount: amountWei,
      });

      // Success!
      setFlowState("success");
      setStatusMessage(`Payment successful! ${amount} PYUSD sent to merchant.`);
      setTxHash(result.transactionHash);
      updateStepStatus(2, "complete");
    } catch (error) {
      console.error("Customer tap error:", error);
      setFlowState("error");
      setStatusMessage(error instanceof Error ? error.message : "Payment failed");
      updateStepStatus(2, "error");
    }
  };

  const handleReset = () => {
    setFlowState("idle");
    setStatusMessage("");
    setCurrentStep(1);
    setAmount("");
    setMerchantAddress("");
    setMerchantChipAddress("");
    setTxHash("");
    setSteps([
      { id: 1, title: "Merchant Setup", description: "Enter amount and tap merchant chip", status: "active" },
      { id: 2, title: "Customer Payment", description: "Customer taps chip to authorize payment", status: "idle" },
    ]);
  };

  const getStateIcon = () => {
    switch (flowState) {
      case "merchant-tapping":
      case "customer-tapping":
      case "processing":
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
      case "success":
        return <CheckCircle2 className="h-8 w-8 text-success" />;
      case "error":
        return <AlertCircle className="h-8 w-8 text-error" />;
      default:
        return <DollarSign className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-base-100">
      <div className="flex-1 flex items-center justify-center p-4 pb-24">
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-base-content">Payment Terminal</h1>
            <p className="text-base-content/60">Tap-to-pay with PYUSD</p>
          </div>

          {/* Progress Indicator */}
          <PaymentStepIndicator steps={steps} currentStep={currentStep} />

          {/* Steps Display */}
          <div className="space-y-3">
            {steps.map(step => (
              <PaymentStep key={step.id} step={step} />
            ))}
          </div>

          {/* Status Card */}
          <div className="bg-base-200 rounded-lg p-6 border-2 border-base-300">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">{getStateIcon()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-base-content/70">Status</p>
                <p className="text-base text-base-content font-medium mt-1">
                  {statusMessage || (currentStep === 1 ? "Ready to accept payment" : "Waiting for customer")}
                </p>
              </div>
            </div>
          </div>

          {/* Merchant Info (Step 1) */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-bold text-base-content/70 mb-2">Payment Amount (PYUSD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 rounded-lg text-lg font-mono focus:border-primary focus:outline-none"
                  disabled={flowState !== "idle"}
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Merchant Tap Button */}
              <button
                onClick={handleMerchantTap}
                disabled={flowState !== "idle" || !amount || parseFloat(amount) <= 0}
                className="w-full btn btn-primary btn-lg gap-2"
              >
                <Nfc className="h-5 w-5" />
                {flowState === "merchant-tapping" ? "Tapping..." : "Merchant: Tap Your Chip"}
              </button>
            </div>
          )}

          {/* Customer Info (Step 2) */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Payment Details */}
              <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/30">
                <p className="text-xs font-bold text-primary/70 mb-2">Payment Request</p>
                <p className="text-3xl font-bold text-primary font-mono">{amount} PYUSD</p>
              </div>

              {/* Merchant -> Customer Route */}
              {merchantChipAddress && (
                <ChipOwnerDisplay chipAddress={merchantChipAddress} ownerAddress={merchantAddress} />
              )}

              {/* Approval Button (only show if insufficient allowance) */}
              {address && allowance < parseUnits(amount || "0", 6) && (
                <button
                  onClick={handleApprovePYUSD}
                  disabled={flowState === "approving"}
                  className="w-full btn btn-secondary btn-sm gap-2"
                >
                  <Shield className="h-4 w-4" />
                  {flowState === "approving" ? "Approving..." : "Approve PYUSD (Required)"}
                </button>
              )}

              {/* Customer Tap Button */}
              <button
                onClick={handleCustomerTap}
                disabled={flowState !== "idle"}
                className="w-full btn btn-primary btn-lg gap-2"
              >
                <User className="h-5 w-5" />
                {flowState === "customer-tapping" || flowState === "processing"
                  ? "Processing..."
                  : "Customer: Tap to Pay"}
              </button>
            </div>
          )}

          {/* Success State */}
          {flowState === "success" && txHash && (
            <div className="space-y-4">
              <div className="bg-success/10 rounded-lg p-4 border-2 border-success/30">
                <p className="text-sm font-bold text-success mb-2">Transaction Hash</p>
                <p className="text-xs font-mono text-success break-all">{txHash}</p>
              </div>

              <button onClick={handleReset} className="w-full btn btn-primary btn-lg">
                New Payment
              </button>
            </div>
          )}

          {/* Error State Reset Button */}
          {flowState === "error" && (
            <button onClick={handleReset} className="w-full btn btn-outline">
              Reset Terminal
            </button>
          )}
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
