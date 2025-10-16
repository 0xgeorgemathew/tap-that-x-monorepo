"use client";

import { encodePacked, keccak256 } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, isLoading, error } = useHaloChip();

  // Get contract for current chain
  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const chipRegistryAddress = contracts?.ChipRegistry?.address;
  const chipRegistryAbi = contracts?.ChipRegistry?.abi;

  const handleRegister = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    if (!chipRegistryAddress || !chipRegistryAbi) {
      alert("ChipRegistry not deployed on this network");
      return;
    }

    try {
      // 1. Tap to get chip address
      const chipData = await signMessage({ message: "init", format: "text" });
      const chipAddress = chipData.address as `0x${string}`;

      // 2. Tap to sign registration (chip signs: keccak256(owner, chipAddress))
      const messageToSign = keccak256(encodePacked(["address", "address"], [address, chipAddress]));
      const registrationSig = await signMessage({ message: messageToSign });

      // 3. Register on-chain
      writeContract({
        address: chipRegistryAddress,
        abi: chipRegistryAbi,
        functionName: "registerChip",
        args: [chipAddress, registrationSig.signature as `0x${string}`],
      });
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Register Chip</h1>

      {!address && (
        <div className="alert alert-warning mb-4">
          <span>Please connect your wallet to register a chip</span>
        </div>
      )}

      <button onClick={handleRegister} disabled={isLoading || !address} className="btn btn-primary w-full">
        {isLoading ? "Tap your chip now..." : "Tap Chip to Register"}
      </button>

      {error && (
        <div className="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
