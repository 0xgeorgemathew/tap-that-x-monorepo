import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface ChipAddressDisplayProps {
  address: string;
}

export function ChipAddressDisplay({ address }: ChipAddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-base-200 rounded-lg p-4 border-2 border-base-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-base-content/70 mb-2">Chip Address</p>
          <p className="font-mono text-sm break-all text-base-content font-medium">{address}</p>
        </div>
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-sm btn-square flex-shrink-0"
          aria-label="Copy address"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
