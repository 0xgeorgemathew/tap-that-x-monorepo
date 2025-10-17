import { CheckCircle, Copy } from "lucide-react";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth/useCopyToClipboard";

export const AddressCopyIcon = ({ className, address }: { className?: string; address: string }) => {
  const { copyToClipboard: copyAddressToClipboard, isCopiedToClipboard: isAddressCopiedToClipboard } =
    useCopyToClipboard();

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        copyAddressToClipboard(address);
      }}
      type="button"
    >
      {isAddressCopiedToClipboard ? (
        <CheckCircle className={className} aria-hidden="true" />
      ) : (
        <Copy className={className} aria-hidden="true" />
      )}
    </button>
  );
};
