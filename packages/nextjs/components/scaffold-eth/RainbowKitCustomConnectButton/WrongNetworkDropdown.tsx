import { NetworkOptions } from "./NetworkOptions";
import { ArrowLeftRight, ChevronDown, LogOut } from "lucide-react";
import { baseSepolia } from "viem/chains";
import { useDisconnect, useSwitchChain } from "wagmi";

export const WrongNetworkDropdown = () => {
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const handleSwitchToBase = () => {
    switchChain?.({ chainId: baseSepolia.id });
  };

  return (
    <div className="dropdown dropdown-end mr-2">
      <label tabIndex={0} className="btn btn-error btn-sm dropdown-toggle gap-1">
        <span>Wrong network</span>
        <ChevronDown className="h-6 w-4 ml-2 sm:ml-0" />
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 mt-1 shadow-center shadow-accent bg-base-200 rounded-box gap-1"
      >
        {/* Primary action: Switch to Base */}
        <li>
          <button
            className="menu-item btn-sm rounded-xl! flex gap-3 py-3 bg-primary text-primary-content hover:bg-primary-focus font-semibold"
            type="button"
            onClick={handleSwitchToBase}
          >
            <ArrowLeftRight className="h-6 w-4 ml-2 sm:ml-0" />
            <span>Switch to Base Sepolia</span>
          </button>
        </li>

        {/* Divider */}
        <div className="divider my-0 h-px" />

        {/* Other network options */}
        <NetworkOptions />

        {/* Disconnect option */}
        <div className="divider my-0 h-px" />
        <li>
          <button
            className="menu-item text-error btn-sm rounded-xl! flex gap-3 py-3"
            type="button"
            onClick={() => disconnect()}
          >
            <LogOut className="h-6 w-4 ml-2 sm:ml-0" />
            <span>Disconnect</span>
          </button>
        </li>
      </ul>
    </div>
  );
};
