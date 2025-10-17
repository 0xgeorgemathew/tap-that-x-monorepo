import Link from "next/link";
import { CheckCircle, Copy } from "lucide-react";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth/useCopyToClipboard";

export const TransactionHash = ({ hash }: { hash: string }) => {
  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();

  return (
    <div className="flex items-center">
      <Link href={`/blockexplorer/transaction/${hash}`}>
        {hash?.substring(0, 6)}...{hash?.substring(hash.length - 4)}
      </Link>
      {isAddressCopiedToClipboard ? (
        <CheckCircle
          className="ml-1.5 text-xl font-normal text-base-content h-5 w-5 cursor-pointer"
          aria-hidden="true"
        />
      ) : (
        <Copy
          className="ml-1.5 text-xl font-normal h-5 w-5 cursor-pointer"
          aria-hidden="true"
          onClick={() => copyAddressToClipboard(hash)}
        />
      )}
    </div>
  );
};
