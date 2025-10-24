"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Settings, Wallet } from "lucide-react";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import deployedContracts from "~~/contracts/deployedContracts";
import { actionTemplates, erc20TransferTemplate, formatTokenAmount } from "~~/utils/actionTemplates";

type FlowState = "idle" | "configuring" | "submitting" | "success" | "error";

// ERC20 ABI for querying token decimals
const ERC20_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export default function ConfigurePage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContract, isPending: isTxPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedChip, setSelectedChip] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(erc20TransferTemplate.id);

  // Form fields for USDC/ERC20 transfer
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18); // Default to 18 decimals

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const registryAddress = contracts?.TapThatXRegistry?.address;
  const registryAbi = contracts?.TapThatXRegistry?.abi;
  const configurationAddress = contracts?.TapThatXConfiguration?.address;
  const configurationAbi = contracts?.TapThatXConfiguration?.abi;
  const protocolAddress = contracts?.TapThatXProtocol?.address;

  // Get USDC address for this chain
  const mockUSDCAddress = contracts?.MockUSDC?.address;

  // Query registered chips
  const { data: ownerChipsData } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getOwnerChips",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!registryAddress && !!registryAbi,
    },
  });

  const registeredChips = (ownerChipsData as string[]) || [];

  // Query existing configuration for selected chip
  const { data: existingConfig, refetch: refetchConfig } = useReadContract({
    address: configurationAddress,
    abi: configurationAbi,
    functionName: "getConfiguration",
    args: address && selectedChip ? [address, selectedChip as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!selectedChip && !!configurationAddress && !!configurationAbi,
    },
  });

  // Query token decimals dynamically
  const { data: decimalsData } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!tokenAddress && tokenAddress.startsWith("0x") && tokenAddress.length === 42,
    },
  });

  // Update token decimals when fetched
  useEffect(() => {
    if (decimalsData !== undefined) {
      setTokenDecimals(Number(decimalsData));
    }
  }, [decimalsData]);

  // Auto-select first chip if available
  useEffect(() => {
    if (registeredChips.length > 0 && !selectedChip) {
      setSelectedChip(registeredChips[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredChips.length, selectedChip]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setFlowState("success");
      setStatusMessage("Configuration saved successfully!");
      refetchConfig();
    }
  }, [isConfirmed, refetchConfig]);

  const handleSaveConfiguration = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      setFlowState("error");
      return;
    }

    if (!selectedChip) {
      setStatusMessage("Please select a chip");
      setFlowState("error");
      return;
    }

    if (!configurationAddress || !configurationAbi) {
      setStatusMessage("TapThatXConfiguration not deployed on this network");
      setFlowState("error");
      return;
    }

    if (!protocolAddress) {
      setStatusMessage("TapThatXProtocol not deployed on this network");
      setFlowState("error");
      return;
    }

    try {
      setFlowState("configuring");

      // Build callData based on selected template
      const template = actionTemplates.find(t => t.id === selectedTemplate);
      if (!template) throw new Error("Invalid template");

      let callDataResult;

      if (template.id === "erc20-transfer") {
        if (!tokenAddress || !recipient || !amount) {
          throw new Error("Please fill in all fields");
        }

        const amountBigInt = formatTokenAmount(amount, tokenDecimals);
        callDataResult = template.buildCallData({
          tokenAddress: tokenAddress as `0x${string}`,
          from: address,
          to: recipient as `0x${string}`,
          amount: amountBigInt,
        });
      } else {
        throw new Error("Template not yet implemented");
      }

      const finalDescription =
        description || `Send ${amount} tokens to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`;

      setFlowState("submitting");
      setStatusMessage("Please confirm the transaction in your wallet...");

      writeContract(
        {
          address: configurationAddress,
          abi: configurationAbi,
          functionName: "setConfiguration",
          args: [selectedChip as `0x${string}`, callDataResult.target, callDataResult.callData, finalDescription],
        },
        {
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
    setAmount("");
    setRecipient("");
    setDescription("");
  };

  const config = existingConfig as
    | { targetContract: string; staticCallData: string; description: string; isActive: boolean }
    | undefined;

  return (
    <div className="flex items-start justify-center p-4 sm:p-6 pb-24">
      <div className="w-full max-w-2xl">
        {/* Main Glass Card */}
        <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col max-h-[calc(100vh-8rem)] sm:max-h-none overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="round-icon w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mb-2 sm:mb-3 md:mb-4">
              <Settings className="h-12 w-12 sm:h-14 sm:w-14" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-base-content mb-1.5 sm:mb-2">
              Configure Tap Action
            </h1>
            <p className="text-sm sm:text-base text-base-content/70">Set up what happens when you tap your chip</p>
          </div>

          {/* Wallet Alert */}
          {!address && (
            <div className="glass-alert mb-4">
              <Wallet className="h-5 w-5 text-warning" />
              <span className="text-sm font-semibold text-base-content">Connect your wallet to continue</span>
            </div>
          )}

          {/* No Chips Alert */}
          {address && registeredChips.length === 0 && (
            <div className="glass-alert mb-4">
              <AlertCircle className="h-5 w-5 text-warning" />
              <span className="text-sm font-semibold text-base-content">
                No chips registered. Please register a chip first.
              </span>
            </div>
          )}

          {/* Configuration Form */}
          {address && registeredChips.length > 0 && (
            <div className="space-y-4">
              {/* Chip Selection */}
              <div>
                <label className="block text-sm font-semibold text-base-content mb-2">Select Chip</label>
                <select
                  value={selectedChip}
                  onChange={e => setSelectedChip(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {registeredChips.map(chip => (
                    <option key={chip} value={chip} className="address-display">
                      {chip.slice(0, 6)}...{chip.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Existing Configuration Display */}
              {config && config.targetContract !== "0x0000000000000000000000000000000000000000" && (
                <div className="glass-alert">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-base-content">Current Configuration</p>
                    <p className="text-xs text-base-content/70 mt-1">{config.description}</p>
                    <p className="text-xs text-base-content/50 mt-1 address-display">
                      Target: {config.targetContract.slice(0, 6)}...{config.targetContract.slice(-4)}
                    </p>
                    <p className="text-xs text-base-content/50">Status: {config.isActive ? "Active" : "Inactive"}</p>
                  </div>
                </div>
              )}

              {/* Action Template Selection */}
              <div>
                <label className="block text-sm font-semibold text-base-content mb-2">Action Type</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {actionTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template-specific Fields */}
              {selectedTemplate === "erc20-transfer" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-base-content mb-2">Token Address</label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={e => setTokenAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-base sm:text-sm"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      {mockUSDCAddress && (
                        <button
                          type="button"
                          onClick={() => setTokenAddress(mockUSDCAddress)}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          Use MockUSDC ({mockUSDCAddress.slice(0, 6)}...{mockUSDCAddress.slice(-4)})
                        </button>
                      )}
                      {tokenAddress && (
                        <button
                          type="button"
                          onClick={() => setTokenAddress("")}
                          className="text-xs text-base-content/50 hover:text-error font-medium flex items-center gap-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {tokenAddress && decimalsData !== undefined && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="glass-badge text-success border-success/50">
                          <CheckCircle2 className="h-3 w-3" />
                          {tokenDecimals} decimals
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-base-content mb-2">Recipient Address</label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-base sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-base-content mb-2">Amount</label>
                    <input
                      type="text"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="10.00"
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50 text-base sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-base-content mb-2">Description (optional)</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g., Send 10 USDC to Alice"
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg bg-base-200/50 border border-base-300/50 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50 text-base sm:text-sm"
                    />
                  </div>

                  {/* Important Note about Approval */}
                  <div className="glass-alert flex-col sm:flex-row items-start sm:items-center">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-info flex-shrink-0" />
                      <p className="text-xs sm:text-sm font-semibold text-base-content">Token Approval Required</p>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:ml-auto">
                      <a href="/approve" className="text-xs text-primary font-medium hover:underline">
                        Approve Now →
                      </a>
                    </div>
                  </div>
                </>
              )}

              {/* Status Messages */}
              {statusMessage && flowState !== "idle" && (
                <div className="text-center py-3 fade-in">
                  <div className="flex items-center justify-center gap-2.5">
                    {flowState === "error" ? (
                      <AlertCircle className="h-5 w-5 text-error" />
                    ) : flowState === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                    <p className="text-sm font-semibold text-base-content">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                {flowState === "success" ? (
                  <button onClick={resetFlow} className="glass-btn flex-1 text-sm sm:text-base">
                    Configure Another
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveConfiguration}
                      disabled={isTxPending || isConfirming || !address || !selectedChip}
                      className="glass-btn flex-1 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {isTxPending || isConfirming ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>{isTxPending ? "Submitting..." : "Confirming..."}</span>
                        </>
                      ) : (
                        <>
                          <Settings className="h-5 w-5" />
                          <span>Save Configuration</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
