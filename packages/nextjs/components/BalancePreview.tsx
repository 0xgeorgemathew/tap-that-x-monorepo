"use client";

import { ArrowRight, Check, Zap } from "lucide-react";
import { formatUnits } from "viem";

interface BalancePreviewProps {
  currentBalance: bigint;
  amount: bigint;
  recipientAddress: string;
  decimals?: number;
  tokenSymbol?: string;
  estimatedTime?: string;
  showGasFeeBadge?: boolean;
}

export const BalancePreview = ({
  currentBalance,
  amount,
  recipientAddress,
  decimals = 6,
  tokenSymbol = "USDC",
  estimatedTime = "10-15 sec",
  showGasFeeBadge = true,
}: BalancePreviewProps) => {
  const currentFormatted = formatUnits(currentBalance, decimals);
  const amountFormatted = formatUnits(amount, decimals);
  const newBalance = currentBalance - amount;
  const newFormatted = formatUnits(newBalance, decimals);

  // Format numbers with proper decimal places
  const formatNumber = (num: string) => {
    const parsed = parseFloat(num);
    return parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="balance-preview-container">
      {/* Balance Impact */}
      <div className="balance-preview-section">
        <div className="balance-preview-label">Balance Impact</div>
        <div className="balance-preview-amounts">
          <div className="balance-preview-amount-current">
            <span className="balance-preview-amount-value">${formatNumber(currentFormatted)}</span>
            <span className="balance-preview-amount-label">Current</span>
          </div>

          <ArrowRight className="balance-preview-arrow" />

          <div className="balance-preview-amount-new">
            <span className="balance-preview-amount-value">${formatNumber(newFormatted)}</span>
            <span className="balance-preview-amount-label">New</span>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="balance-preview-section">
        <div className="balance-preview-detail-row">
          <span className="balance-preview-detail-label">Amount</span>
          <span className="balance-preview-detail-value">
            {amountFormatted} {tokenSymbol}
          </span>
        </div>
        <div className="balance-preview-detail-row">
          <span className="balance-preview-detail-label">Recipient</span>
          <span className="balance-preview-detail-value-address" title={recipientAddress}>
            {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}
          </span>
        </div>
        <div className="balance-preview-detail-row">
          <span className="balance-preview-detail-label">Est. Time</span>
          <span className="balance-preview-detail-value">{estimatedTime}</span>
        </div>
      </div>

      {/* Gas Fee Badge */}
      {showGasFeeBadge && (
        <div className="balance-preview-gas-badge">
          <Zap className="h-4 w-4" />
          <span>Gas fees paid by TapThat X</span>
          <Check className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
