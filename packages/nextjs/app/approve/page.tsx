"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Settings, Shield, Wallet, Zap } from "lucide-react";
import { formatUnits, maxUint256 } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";
import deployedContracts from "~~/contracts/deployedContracts";

interface TokenApprovalStatus {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  currentAllowance: bigint;
  isApproved: boolean;
  isUnlimited: boolean;
  isLoading: boolean;
}

export default function ApprovePage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { writeContract, isPending } = useWriteContract();

  const [tokenApprovals, setTokenApprovals] = useState<TokenApprovalStatus[]>([]);
  const [detectedTokens, setDetectedTokens] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
  const PROTOCOL_ADDRESS = contracts?.TapThatXProtocol?.address;

  // Detect tokens from user configurations and check approval status
  useEffect(() => {
    const detectConfiguredTokens = async () => {
      if (!address || !publicClient || !contracts || !PROTOCOL_ADDRESS) return;

      try {
        setIsLoading(true);

        // Get all user's chips
        const chips = (await publicClient.readContract({
          address: contracts.TapThatXRegistry.address,
          abi: contracts.TapThatXRegistry.abi,
          functionName: "getOwnerChips",
          args: [address],
        })) as string[];

        const tokensSet = new Set<string>();

        // For each chip, get configuration and extract token address
        for (const chip of chips) {
          const config = (await publicClient.readContract({
            address: contracts.TapThatXConfiguration.address,
            abi: contracts.TapThatXConfiguration.abi,
            functionName: "getConfiguration",
            args: [address, chip],
          })) as { targetContract: string; staticCallData: string; description: string; isActive: boolean };

          // Check if config exists (target contract is not zero address)
          if (config.targetContract !== "0x0000000000000000000000000000000000000000") {
            // For ERC20 transfers, targetContract IS the token address
            tokensSet.add(config.targetContract);
          }
        }

        setDetectedTokens(tokensSet);

        // Fetch approval status for each detected token
        const approvals: TokenApprovalStatus[] = [];
        for (const tokenAddress of tokensSet) {
          try {
            // Fetch allowance
            const allowance = (await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: contracts.MockUSDC.abi, // Generic ERC20 ABI
              functionName: "allowance",
              args: [address, PROTOCOL_ADDRESS],
            })) as bigint;

            // Fetch token symbol
            const symbol = (await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: [
                {
                  name: "symbol",
                  type: "function",
                  stateMutability: "view",
                  inputs: [],
                  outputs: [{ name: "", type: "string" }],
                },
              ],
              functionName: "symbol",
            })) as string;

            // Fetch token decimals
            const decimals = (await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: [
                {
                  name: "decimals",
                  type: "function",
                  stateMutability: "view",
                  inputs: [],
                  outputs: [{ name: "", type: "uint8" }],
                },
              ],
              functionName: "decimals",
            })) as number;

            approvals.push({
              tokenAddress,
              tokenSymbol: symbol,
              tokenDecimals: decimals,
              currentAllowance: allowance,
              isApproved: allowance > 0n,
              isUnlimited: allowance === maxUint256,
              isLoading: false,
            });
          } catch (err) {
            console.error(`Failed to fetch data for token ${tokenAddress}:`, err);
            // Add with default values if token data fetch fails
            approvals.push({
              tokenAddress,
              tokenSymbol: "Unknown",
              tokenDecimals: 18,
              currentAllowance: 0n,
              isApproved: false,
              isUnlimited: false,
              isLoading: false,
            });
          }
        }

        setTokenApprovals(approvals);
      } catch (err) {
        console.error("Failed to detect tokens:", err);
        setError("Failed to detect configured tokens");
      } finally {
        setIsLoading(false);
      }
    };

    detectConfiguredTokens();
  }, [address, publicClient, contracts, PROTOCOL_ADDRESS]);

  const handleApproveToken = async (tokenAddress: string) => {
    if (!address || !PROTOCOL_ADDRESS) return;

    try {
      setTokenApprovals(prev => prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: true } : t)));
      setError("");
      setStatusMessage("Please confirm approval in your wallet...");

      writeContract(
        {
          address: tokenAddress as `0x${string}`,
          abi: contracts.MockUSDC.abi,
          functionName: "approve",
          args: [PROTOCOL_ADDRESS, maxUint256],
        },
        {
          onSuccess: () => {
            setStatusMessage("Token approved successfully!");
            // Refresh approval status
            setTimeout(() => {
              setTokenApprovals(prev =>
                prev.map(t =>
                  t.tokenAddress === tokenAddress
                    ? { ...t, isApproved: true, isUnlimited: true, currentAllowance: maxUint256, isLoading: false }
                    : t,
                ),
              );
            }, 2000);
          },
          onError: err => {
            setError(`Approval failed: ${err.message}`);
            setStatusMessage("");
            setTokenApprovals(prev =>
              prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: false } : t)),
            );
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
      setStatusMessage("");
      setTokenApprovals(prev => prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: false } : t)));
    }
  };

  const handleRevokeToken = async (tokenAddress: string) => {
    if (!address || !PROTOCOL_ADDRESS) return;

    try {
      setTokenApprovals(prev => prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: true } : t)));
      setError("");
      setStatusMessage("Please confirm revocation in your wallet...");

      writeContract(
        {
          address: tokenAddress as `0x${string}`,
          abi: contracts.MockUSDC.abi,
          functionName: "approve",
          args: [PROTOCOL_ADDRESS, 0n],
        },
        {
          onSuccess: () => {
            setStatusMessage("Approval revoked successfully");
            setTimeout(() => {
              setTokenApprovals(prev =>
                prev.map(t =>
                  t.tokenAddress === tokenAddress
                    ? { ...t, isApproved: false, isUnlimited: false, currentAllowance: 0n, isLoading: false }
                    : t,
                ),
              );
            }, 2000);
          },
          onError: err => {
            setError(`Revocation failed: ${err.message}`);
            setStatusMessage("");
            setTokenApprovals(prev =>
              prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: false } : t)),
            );
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
      setStatusMessage("");
      setTokenApprovals(prev => prev.map(t => (t.tokenAddress === tokenAddress ? { ...t, isLoading: false } : t)));
    }
  };

  return (
    <div className="flex items-start justify-center p-4 sm:p-6 pb-24">
      <div className="w-full max-w-2xl">
        {/* Main Glass Card */}
        <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col">
          {/* Header - Compact */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="round-icon w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-3">
              <Shield className="h-9 w-9 sm:h-11 sm:w-11" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-base-content mb-1">Token Approvals</h1>
            <p className="text-xs sm:text-sm text-base-content/70">
              Manage spending permissions for your configured tokens
            </p>
          </div>

          {/* Wallet Alert */}
          {!address && (
            <div className="glass-alert mb-4">
              <Wallet className="h-5 w-5 text-warning" />
              <span className="text-sm font-semibold text-base-content">Connect wallet to continue</span>
            </div>
          )}

          {/* Network Alert */}
          {address && !contracts && (
            <div className="glass-alert mb-4">
              <AlertCircle className="h-5 w-5 text-warning" />
              <span className="text-sm font-semibold text-base-content">Contracts not deployed on this network</span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-base-content/80 font-medium text-sm">Detecting configured tokens...</span>
            </div>
          )}

          {/* No Configurations Found */}
          {!isLoading && address && contracts && detectedTokens.size === 0 && (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="h-12 w-12 text-base-content/40 mx-auto" />
              <p className="text-base-content/70 font-medium">No token configurations found</p>
              <p className="text-xs text-base-content/50">Configure a chip action first to enable approvals</p>
              <a
                href="/configure"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all"
              >
                <Settings className="h-4 w-4" />
                Configure Chip
              </a>
            </div>
          )}

          {/* Token Pills List */}
          {!isLoading && tokenApprovals.length > 0 && (
            <div className="space-y-3">
              <div className="mb-2">
                <p className="text-xs sm:text-sm font-semibold text-base-content/70">
                  {tokenApprovals.length} Token{tokenApprovals.length !== 1 ? "s" : ""} Detected
                </p>
                {tokenApprovals.some(t => !t.isApproved) && (
                  <p className="text-xs text-base-content/50 mt-1">
                    💡 Approve each token individually to enable tap-to-pay
                  </p>
                )}
              </div>

              {tokenApprovals.map(token => (
                <div
                  key={token.tokenAddress}
                  className={`token-pill ${token.isApproved ? "token-pill-approved" : "token-pill-pending"}`}
                >
                  {/* Token Icon */}
                  <div className="token-pill-icon">
                    {token.isApproved ? (
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="token-pill-content">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="token-pill-name">{token.tokenSymbol}</p>
                      <span
                        className={`token-pill-status ${
                          token.isApproved ? "token-pill-status-approved" : "token-pill-status-pending"
                        }`}
                      >
                        {token.isUnlimited ? "Unlimited" : token.isApproved ? "Approved" : "Pending"}
                      </span>
                    </div>
                    <p className="token-pill-address">
                      {token.tokenAddress.slice(0, 10)}...{token.tokenAddress.slice(-8)}
                    </p>
                    {token.isApproved && !token.isUnlimited && (
                      <p className="text-xs text-base-content/50 mt-1">
                        Allowance: {formatUnits(token.currentAllowance, token.tokenDecimals)} {token.tokenSymbol}
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col gap-2">
                    {!token.isApproved ? (
                      <button
                        onClick={() => handleApproveToken(token.tokenAddress)}
                        disabled={token.isLoading || isPending}
                        className="token-pill-action"
                      >
                        {token.isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                            Approving
                          </>
                        ) : (
                          "Approve"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevokeToken(token.tokenAddress)}
                        disabled={token.isLoading || isPending}
                        className="token-pill-action token-pill-action-danger"
                      >
                        {token.isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                            Revoking
                          </>
                        ) : (
                          "Revoke"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Note */}
          {tokenApprovals.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-base-200/30 border border-base-300/30">
              <p className="text-xs text-base-content/60 leading-relaxed">
                💡 Approvals allow TapThatXProtocol to transfer tokens on your behalf when you execute taps. You can
                revoke approvals anytime.
              </p>
            </div>
          )}

          {/* Status Messages */}
          {statusMessage && (
            <div className={`mt-4 ${error ? "glass-alert-error" : "glass-alert"}`}>
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : error ? (
                <AlertCircle className="h-5 w-5 text-error" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
              <span className="text-sm font-semibold text-base-content">{statusMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && !statusMessage && (
            <div className="mt-4 glass-alert-error">
              <AlertCircle className="h-5 w-5 text-error" />
              <span className="text-sm font-semibold text-base-content">{error}</span>
            </div>
          )}

          {/* Navigation to Configure/Execute */}
          {tokenApprovals.length > 0 && tokenApprovals.every(t => t.isApproved) && (
            <div className="mt-6 flex gap-3">
              <a
                href="/configure"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-base-200/50 border border-base-300/50 text-base-content text-sm font-semibold hover:bg-base-200/70 transition-all"
              >
                <Settings className="h-4 w-4" />
                Configure
              </a>
              <a
                href="/execute"
                className="flex-1 glass-btn flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Zap className="h-5 w-5" />
                Execute Tap
              </a>
            </div>
          )}
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
}
