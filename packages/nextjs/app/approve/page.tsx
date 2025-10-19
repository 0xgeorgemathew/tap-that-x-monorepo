"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Shield, Wallet } from "lucide-react";
import { formatUnits, maxUint256 } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";

export default function ApprovePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { writeContract, isPending, isSuccess } = useWriteContract();

  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const PROTOCOL_ADDRESS = contracts?.TapThatXProtocol?.address;
  const USDC = contracts?.MockUSDC?.address;

  // Check current allowance
  useEffect(() => {
    const checkAllowance = async () => {
      if (!address || !publicClient || !USDC || !PROTOCOL_ADDRESS) return;

      try {
        setIsLoading(true);
        const currentAllowance = (await publicClient.readContract({
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "allowance",
          args: [address, PROTOCOL_ADDRESS],
        })) as bigint;

        setAllowance(currentAllowance);
      } catch (err) {
        console.error("Failed to check allowance:", err);
        setError("Failed to check approval status");
      } finally {
        setIsLoading(false);
      }
    };

    checkAllowance();
  }, [address, publicClient, USDC, PROTOCOL_ADDRESS, contracts, isSuccess]);

  const handleApprove = async () => {
    if (!address || !USDC || !PROTOCOL_ADDRESS) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setError("");
      setStatusMessage("Please confirm the approval in your wallet...");

      writeContract(
        {
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "approve",
          args: [PROTOCOL_ADDRESS, maxUint256],
        },
        {
          onSuccess: () => {
            setStatusMessage("Success! You can now make tap-to-pay payments.");
          },
          onError: err => {
            setError(`Transaction failed: ${err.message}`);
            setStatusMessage("");
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
      setStatusMessage("");
    }
  };

  const handleRevoke = async () => {
    if (!address || !USDC || !PROTOCOL_ADDRESS) return;

    try {
      setError("");
      setStatusMessage("Please confirm the revocation in your wallet...");

      writeContract(
        {
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "approve",
          args: [PROTOCOL_ADDRESS, 0n],
        },
        {
          onSuccess: () => {
            setStatusMessage("Approval revoked successfully.");
          },
          onError: err => {
            setError(`Transaction failed: ${err.message}`);
            setStatusMessage("");
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
      setStatusMessage("");
    }
  };

  const isApproved = allowance !== null && allowance > 0n;
  const isUnlimited = allowance !== null && allowance === maxUint256;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 gradient-bg">
      <div className="w-full max-w-lg">
        {/* Main Glass Card */}
        <div className="glass-card p-6 sm:p-8 md:p-10 flex flex-col">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="round-icon w-20 h-20 sm:w-24 sm:h-24 mb-5 animate-pulse-slow">
              <Shield className="h-12 w-12 sm:h-14 sm:w-14 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">USDC Approval Setup</h1>
            <p className="text-sm sm:text-base text-base-content/80 font-medium px-4">
              One-time approval for seamless tap-to-pay
            </p>
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-5 sm:space-y-6 flex flex-col">
            {/* Wallet Alert */}
            {!address && (
              <div className="glass-alert">
                <Wallet className="h-5 w-5 text-warning" />
                <span className="text-sm font-semibold text-base-content">Connect your wallet to continue</span>
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

            {/* Approval Status */}
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-base-content/80 font-medium">Checking approval status...</span>
              </div>
            )}

            {!isLoading && allowance !== null && (
              <div className="text-center py-4">
                {isApproved ? (
                  <div className="glass-alert-success justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    <div className="flex flex-col">
                      <span className="font-bold text-base-content">
                        {isUnlimited ? "Unlimited Approval Active" : "Approval Active"}
                      </span>
                      {!isUnlimited && (
                        <span className="text-xs text-base-content/70">
                          Allowance: {formatUnits(allowance, 6)} USDC
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="glass-alert justify-center">
                    <AlertCircle className="h-6 w-6 text-warning" />
                    <span className="font-bold text-base-content">Approval required to enable tap-to-pay</span>
                  </div>
                )}
              </div>
            )}

            {/* Status Message */}
            {statusMessage && (
              <div className={isSuccess ? "glass-alert-success" : "glass-alert"}>
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-info" />
                )}
                <span className="text-sm font-semibold text-base-content">{statusMessage}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="glass-alert-error">
                <AlertCircle className="h-5 w-5 text-error" />
                <span className="text-sm font-semibold text-base-content">{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons - Fixed position */}
          <div className="mt-6 space-y-4">
            {!isApproved ? (
              <button
                onClick={handleApprove}
                disabled={isPending || !address || !contracts || isLoading}
                className="glass-btn flex items-center justify-center gap-3 w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-6 w-6" />
                    <span>Approve USDC Spending</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <a href="/payment" className="glass-btn flex items-center justify-center gap-3 w-full">
                  <CreditCard className="h-6 w-6" />
                  <span>Go to Payment Page</span>
                </a>
                <button
                  onClick={handleRevoke}
                  disabled={isPending || !address}
                  className="btn btn-outline btn-error w-full rounded-xl h-12 font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <span>Revoke Approval</span>
                  )}
                </button>
              </>
            )}

            {/* Security Note */}
            <div className="text-xs sm:text-sm text-center text-base-content/60 px-2 space-y-1">
              <p>⚠️ This gives the payment processor unlimited access to your USDC.</p>
              <p>Only approve contracts you trust. You can revoke this anytime.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
