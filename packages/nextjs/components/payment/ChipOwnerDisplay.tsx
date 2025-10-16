import { ArrowRight } from "lucide-react";

interface ChipOwnerDisplayProps {
  chipAddress: string;
  ownerAddress: string;
}

export function ChipOwnerDisplay({ chipAddress, ownerAddress }: ChipOwnerDisplayProps) {
  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="bg-base-200 rounded-lg p-4 border border-base-300">
      <p className="text-xs font-medium text-base-content/60 mb-3">Payment Route</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-base-content/50 mb-1">Chip</p>
          <p className="font-mono text-sm text-base-content">{truncate(chipAddress)}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-base-content/50 mb-1">Owner</p>
          <p className="font-mono text-sm text-base-content">{truncate(ownerAddress)}</p>
        </div>
      </div>
    </div>
  );
}
