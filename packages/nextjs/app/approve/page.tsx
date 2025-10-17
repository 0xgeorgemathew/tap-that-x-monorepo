"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Shield, Wallet } from "lucide-react";
import { formatUnits, maxUint256 } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { Separator } from "~~/components/ui/separator";
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

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const PAYMENT_PROCESSOR = contracts?.USDCPaymentProcessor?.address;
  const USDC = contracts?.MockUSDC?.address;

  // Check current allowance
  useEffect(() => {
    const checkAllowance = async () => {
      if (!address || !publicClient || !USDC || !PAYMENT_PROCESSOR) return;

      try {
        setIsLoading(true);
        const currentAllowance = (await publicClient.readContract({
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "allowance",
          args: [address, PAYMENT_PROCESSOR],
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
  }, [address, publicClient, USDC, PAYMENT_PROCESSOR, contracts, isSuccess]);

  const handleApprove = async () => {
    if (!address || !USDC || !PAYMENT_PROCESSOR) {
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
          args: [PAYMENT_PROCESSOR, maxUint256],
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
    if (!address || !USDC || !PAYMENT_PROCESSOR) return;

    try {
      setError("");
      setStatusMessage("Please confirm the revocation in your wallet...");

      writeContract(
        {
          address: USDC,
          abi: contracts.MockUSDC.abi,
          functionName: "approve",
          args: [PAYMENT_PROCESSOR, 0n],
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-200">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-primary mb-4 transition-transform hover:scale-105 border-4 border-primary">
            <Shield className="h-14 w-14 text-primary-content" />
          </div>
          <h1 className="text-3xl font-bold text-base-content mb-2">USDC Approval Setup</h1>
          <p className="text-base-content/80 font-medium">One-time approval for seamless tap-to-pay</p>
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

          {/* Network Alert */}
          {address && chainId !== 84532 && (
            <div className="alert alert-warning border-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">Please switch to Base Sepolia network</span>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-base-200 rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-base-content flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              How It Works
            </h3>
            <ul className="text-sm text-base-content/80 space-y-1 list-disc list-inside">
              <li>Approve the payment processor contract once</li>
              <li>Make unlimited payments with just a chip tap</li>
              <li>No MetaMask popups during payments</li>
              <li>Revoke approval anytime</li>
            </ul>
          </div>

          <Separator />

          {/* Approval Status */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-base-content/80">Checking approval status...</span>
            </div>
          )}

          {!isLoading && allowance !== null && (
            <div className="space-y-4">
              <div className={`alert border-2 ${isApproved ? "alert-success" : "alert-warning"}`}>
                {isApproved ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">
                        {isUnlimited ? "Unlimited approval granted" : "Approval granted"}
                      </span>
                      {!isUnlimited && (
                        <span className="text-xs">Approved amount: {formatUnits(allowance, 6)} USDC</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">No approval found. Approve to enable tap-to-pay.</span>
                  </>
                )}
              </div>

              {/* Current Allowance Details */}
              <div className="bg-base-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-base-content/60 mb-1">Status</p>
                    <p className="font-semibold text-base-content">{isApproved ? "✅ Approved" : "⚠️ Not Approved"}</p>
                  </div>
                  <div>
                    <p className="text-base-content/60 mb-1">Allowance</p>
                    <p className="font-semibold text-base-content">
                      {isUnlimited ? "Unlimited" : formatUnits(allowance, 6) + " USDC"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className={`alert border-2 ${isSuccess ? "alert-success" : "alert-info"}`}>
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="text-sm font-semibold">{statusMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-error border-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!isApproved ? (
              <button
                onClick={handleApprove}
                disabled={isPending || !address || chainId !== 84532 || isLoading}
                className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:hover:scale-100"
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
                <a
                  href="/payment"
                  className="btn btn-primary w-full h-16 rounded-lg text-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Go to Payment Page</span>
                </a>
                <button
                  onClick={handleRevoke}
                  disabled={isPending || !address}
                  className="btn btn-outline btn-error w-full rounded-lg font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:hover:scale-100"
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
          </div>

          {/* Security Note */}
          <div className="text-xs text-center text-base-content/50 pt-2">
            <p>⚠️ This gives the payment processor unlimited access to your USDC.</p>
            <p>Only approve contracts you trust. You can revoke this anytime.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
