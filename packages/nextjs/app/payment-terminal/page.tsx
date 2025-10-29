"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import { NfcTapZone } from "~~/components/payment/NfcTapZone";
import { NumericKeypad } from "~~/components/payment/NumericKeypad";
import { PaymentReceipt } from "~~/components/payment/PaymentReceipt";
import { TerminalDisplay } from "~~/components/payment/TerminalDisplay";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";
import { usePaymentTerminal } from "~~/hooks/usePaymentTerminal";

type FlowState =
  | "idle"
  | "entering-amount"
  | "merchant-tapping"
  | "customer-tapping"
  | "processing"
  | "success"
  | "error"
  | "approving";

type TerminalStep = "amount" | "merchant" | "customer" | "complete";

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

  const PYUSD_ADDRESS =
    chainId === 11155111 ? "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" : contracts?.MockUSDC?.address;

  const [flowState, setFlowState] = useState<FlowState>("entering-amount");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<TerminalStep>("amount");

  const [amount, setAmount] = useState("");
  const [allowance, setAllowance] = useState<bigint>(0n);

  const [merchantAddress, setMerchantAddress] = useState<string>("");
  const [merchantChipAddress, setMerchantChipAddress] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");

  const [txHash, setTxHash] = useState<string>("");
  const [txTimestamp, setTxTimestamp] = useState<Date>(new Date());

  const { signMessage } = useHaloChip();
  const { executePayment } = usePaymentTerminal(TERMINAL_ADDRESS as `0x${string}`, publicClient);
  const { writeContract } = useWriteContract();

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

  useEffect(() => {
    if (currentStep === "customer" && address) {
      checkAllowance();
    }
  }, [currentStep, address, checkAllowance]);

  const handleNumberClick = (num: string) => {
    if (flowState !== "entering-amount") return;

    if (num === "." && amount.includes(".")) return;

    if (amount.includes(".")) {
      const decimals = amount.split(".")[1];
      if (decimals.length >= 2) return;
    }

    setAmount(prev => prev + num);
  };

  const handleBackspace = () => {
    if (flowState !== "entering-amount") return;
    setAmount(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (flowState !== "entering-amount") return;
    setAmount("");
  };

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
            setStatusMessage("PYUSD approved!");
            setFlowState("idle");
            await checkAllowance();
            setTimeout(() => setStatusMessage(""), 2000);
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
      setTimeout(() => {
        setStatusMessage("");
        setFlowState("entering-amount");
      }, 2000);
      return;
    }

    try {
      setFlowState("merchant-tapping");
      setStatusMessage("Merchant: Tap your NFC chip...");

      const merchantChipData = await signMessage({ message: "init", format: "text" });
      const merchantChip = merchantChipData.address as `0x${string}`;

      const merchantHasChip = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "hasChip",
        args: [address, merchantChip],
      })) as boolean;

      if (!merchantHasChip) {
        setFlowState("error");
        setStatusMessage(`Merchant chip not registered. Please register at /register.`);
        return;
      }

      setMerchantAddress(address);
      setMerchantChipAddress(merchantChip);
      setCurrentStep("customer");
      setFlowState("idle");
      setStatusMessage("");

      await checkAllowance();
    } catch (error) {
      console.error("Merchant tap error:", error);
      setFlowState("error");
      setStatusMessage(error instanceof Error ? error.message : "Failed to detect merchant chip");
    }
  };

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

      const customerChipData = await signMessage({ message: "init", format: "text" });
      const customerChip = customerChipData.address as `0x${string}`;

      const chipOwners = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "getChipOwners",
        args: [customerChip],
      })) as `0x${string}`[];

      if (!chipOwners || chipOwners.length === 0) {
        setFlowState("error");
        setStatusMessage(`Customer chip not registered. Please register at /register.`);
        return;
      }

      const customerWallet = chipOwners[0];
      setCustomerAddress(customerWallet);

      const customerHasChip = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: contracts.TapThatXRegistry.abi,
        functionName: "hasChip",
        args: [customerWallet, customerChip],
      })) as boolean;

      if (!customerHasChip) {
        setFlowState("error");
        setStatusMessage(`Customer chip not properly registered. Please re-register at /register.`);
        return;
      }

      const customerBalance = (await publicClient.readContract({
        address: PYUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [customerWallet],
      })) as bigint;

      const amountWei = parseUnits(amount, 6);

      if (customerBalance < amountWei) {
        setFlowState("error");
        setStatusMessage(
          `Insufficient PYUSD balance. Need ${amount} PYUSD, have ${formatUnits(customerBalance, 6)} PYUSD`,
        );
        return;
      }

      const customerAllowance = (await publicClient.readContract({
        address: PYUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [customerWallet, TERMINAL_ADDRESS],
      })) as bigint;

      if (customerAllowance < amountWei) {
        setFlowState("error");
        setStatusMessage("Customer has not approved PYUSD spending. Please approve at /approve.");
        return;
      }

      setFlowState("processing");
      setStatusMessage("Processing payment...");

      const result = await executePayment({
        payerAddress: customerWallet,
        payerChipAddress: customerChip,
        payeeAddress: merchantAddress as `0x${string}`,
        payeeChipAddress: merchantChipAddress as `0x${string}`,
        tokenAddress: PYUSD_ADDRESS,
        amount: amountWei,
      });

      setTxHash(result.transactionHash);
      setTxTimestamp(new Date());
      setFlowState("success");
      setCurrentStep("complete");
      setStatusMessage("");
    } catch (error) {
      console.error("Customer tap error:", error);
      setFlowState("error");
      setStatusMessage(error instanceof Error ? error.message : "Payment failed");
    }
  };

  const handleReset = () => {
    setFlowState("entering-amount");
    setStatusMessage("");
    setCurrentStep("amount");
    setAmount("");
    setMerchantAddress("");
    setMerchantChipAddress("");
    setCustomerAddress("");
    setTxHash("");
  };

  const handleProceedToMerchant = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setStatusMessage("Please enter a valid amount");
      setTimeout(() => setStatusMessage(""), 2000);
      return;
    }
    setCurrentStep("merchant");
    setFlowState("idle");
  };

  return (
    <div className="gradient-bg min-h-screen flex items-center justify-center p-3 md:p-6 lg:p-8 pb-24">
      <div className="payment-terminal-housing">
        <div className="payment-terminal-screen">
          <TerminalDisplay amount={amount} isActive={parseFloat(amount || "0") > 0} />

          {/* Main Content Area */}
          <div className="p-4 md:p-6 lg:p-8 space-y-3 md:space-y-4">
            {/* Error/Status Message */}
            {statusMessage && (
              <div
                className={`flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl border transition-all text-sm md:text-base ${
                  flowState === "error"
                    ? "bg-error/10 border-error/30 text-error"
                    : flowState === "success"
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-primary/10 border-primary/30 text-primary"
                }`}
              >
                {flowState === "error" && <AlertCircle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />}
                {flowState === "success" && <Check className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />}
                <span className="font-semibold">{statusMessage}</span>
              </div>
            )}

            {/* Amount Entry Step */}
            {currentStep === "amount" && flowState !== "success" && (
              <>
                <NumericKeypad
                  onNumberClick={handleNumberClick}
                  onClear={handleClear}
                  onBackspace={handleBackspace}
                  disabled={flowState !== "entering-amount"}
                />
                <button
                  onClick={handleProceedToMerchant}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="terminal-btn terminal-btn-primary"
                >
                  Continue to Merchant Tap
                </button>
              </>
            )}

            {/* Merchant Tap Step */}
            {currentStep === "merchant" && flowState !== "success" && (
              <>
                <NfcTapZone
                  isActive={flowState === "idle"}
                  isProcessing={flowState === "merchant-tapping"}
                  label="MERCHANT: TAP YOUR CHIP"
                  subLabel={`Charge $${amount} PYUSD`}
                  onClick={handleMerchantTap}
                  disabled={flowState !== "idle"}
                />
                <button
                  onClick={() => {
                    setCurrentStep("amount");
                    setFlowState("entering-amount");
                  }}
                  className="terminal-btn terminal-btn-primary"
                >
                  ← Back to Amount
                </button>
              </>
            )}

            {/* Customer Payment Step */}
            {currentStep === "customer" && flowState !== "success" && (
              <>
                {/* Approval Check */}
                {address && allowance < parseUnits(amount || "0", 6) && (
                  <div className="p-3 md:p-4 rounded-lg md:rounded-xl bg-warning/10 border-2 border-warning/30 space-y-2 md:space-y-3">
                    <p className="text-xs md:text-sm font-semibold text-warning">
                      Customer needs to approve PYUSD spending first
                    </p>
                    <button
                      onClick={handleApprovePYUSD}
                      disabled={flowState === "approving"}
                      className="w-full h-11 md:h-12 rounded-lg md:rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: "rgba(251, 191, 36, 0.2)",
                        border: "2px solid rgba(251, 191, 36, 0.5)",
                        color: "rgba(251, 191, 36, 1)",
                      }}
                    >
                      {flowState === "approving" ? "Approving..." : "Approve PYUSD"}
                    </button>
                  </div>
                )}

                <NfcTapZone
                  isActive={flowState === "idle"}
                  isProcessing={flowState === "customer-tapping" || flowState === "processing"}
                  label="CUSTOMER: TAP TO PAY"
                  subLabel={`$${amount} PYUSD`}
                  onClick={handleCustomerTap}
                  disabled={flowState !== "idle"}
                />
                <button
                  onClick={() => {
                    setCurrentStep("merchant");
                    setFlowState("idle");
                  }}
                  disabled={flowState !== "idle"}
                  className="terminal-btn terminal-btn-primary"
                >
                  ← Change Merchant
                </button>
              </>
            )}

            {/* Success/Receipt Step */}
            {flowState === "success" && txHash && (
              <div className="space-y-4">
                <PaymentReceipt
                  amount={amount}
                  merchantAddress={merchantAddress}
                  customerAddress={customerAddress}
                  txHash={txHash}
                  timestamp={txTimestamp}
                  chainId={chainId}
                />
                <button onClick={handleReset} className="terminal-btn terminal-btn-success">
                  NEW PAYMENT
                </button>
              </div>
            )}

            {/* Error Reset Button */}
            {flowState === "error" && currentStep !== "amount" && (
              <button onClick={handleReset} className="terminal-btn terminal-btn-primary">
                Reset Terminal
              </button>
            )}
          </div>
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
