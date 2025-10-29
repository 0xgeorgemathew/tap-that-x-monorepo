import { Check, ExternalLink } from "lucide-react";

interface PaymentReceiptProps {
  amount: string;
  merchantAddress: string;
  customerAddress: string;
  txHash: string;
  timestamp?: Date;
  chainId?: number;
}

export function PaymentReceipt({
  amount,
  merchantAddress,
  customerAddress,
  txHash,
  timestamp = new Date(),
  chainId,
}: PaymentReceiptProps) {
  const truncate = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const getExplorerUrl = () => {
    if (chainId === 11155111) {
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    } else if (chainId === 84532) {
      return `https://sepolia.basescan.org/tx/${txHash}`;
    }
    return `https://etherscan.io/tx/${txHash}`;
  };

  return (
    <div className="payment-receipt">
      <div className="payment-receipt-header">
        <div className="payment-receipt-check-icon">
          <Check className="h-8 w-8" />
        </div>
        <div className="payment-receipt-status">APPROVED</div>
        <div className="payment-receipt-date">{timestamp.toLocaleString()}</div>
      </div>

      <div className="payment-receipt-divider"></div>

      <div className="payment-receipt-body">
        <div className="payment-receipt-amount-section">
          <div className="payment-receipt-label">AMOUNT</div>
          <div className="payment-receipt-amount">${amount} PYUSD</div>
        </div>

        <div className="payment-receipt-divider"></div>

        <div className="payment-receipt-details">
          <div className="payment-receipt-row">
            <span className="payment-receipt-key">MERCHANT</span>
            <span className="payment-receipt-value font-mono">{truncate(merchantAddress)}</span>
          </div>
          <div className="payment-receipt-row">
            <span className="payment-receipt-key">CUSTOMER</span>
            <span className="payment-receipt-value font-mono">{truncate(customerAddress)}</span>
          </div>
        </div>

        <div className="payment-receipt-divider"></div>

        <div className="payment-receipt-tx">
          <div className="payment-receipt-label">TRANSACTION</div>
          <div className="payment-receipt-tx-hash">{truncate(txHash)}</div>
          <a href={getExplorerUrl()} target="_blank" rel="noopener noreferrer" className="payment-receipt-link">
            View on Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="payment-receipt-footer">
        <div className="payment-receipt-footer-text">THANK YOU</div>
      </div>
    </div>
  );
}
