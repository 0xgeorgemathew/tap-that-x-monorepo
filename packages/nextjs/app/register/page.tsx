"use client";

import { useState } from "react";
import { encodePacked, keccak256 } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function RegisterPage() {
  const { address } = useAccount();
  const { writeContract, isPending: isTxPending, isSuccess: isTxSuccess, error: txError } = useWriteContract();
  const chainId = useChainId();
  const { signMessage, isLoading, error } = useHaloChip();
  const [status, setStatus] = useState<string>("");

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
      setStatus("Reading chip address...");

      // 1. Tap to get chip address
      const chipData = await signMessage({ message: "init", format: "text" });
      const chipAddress = chipData.address as `0x${string}`;

      console.log("Chip address:", chipAddress);
      setStatus(`Chip detected: ${chipAddress.slice(0, 10)}...`);

      // 2. Tap to sign registration (chip signs: keccak256(owner, chipAddress))
      setStatus("Tap again to sign registration...");
      const messageToSign = keccak256(encodePacked(["address", "address"], [address, chipAddress]));
      console.log("Message to sign:", messageToSign);

      const registrationSig = await signMessage({ message: messageToSign });
      console.log("Registration signature:", registrationSig.signature);

      setStatus("Sending transaction...");

      // 3. Register on-chain
      writeContract(
        {
          address: chipRegistryAddress,
          abi: chipRegistryAbi,
          functionName: "registerChip",
          args: [chipAddress, registrationSig.signature as `0x${string}`],
        },
        {
          onSuccess: hash => {
            console.log("Transaction hash:", hash);
            setStatus(`Success! Transaction: ${hash}`);
          },
          onError: err => {
            console.error("Transaction error:", err);
            setStatus(`Transaction failed: ${err.message}`);
          },
        },
      );
    } catch (err) {
      console.error("Registration failed:", err);
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
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

      <button
        onClick={handleRegister}
        disabled={isLoading || isTxPending || !address}
        className="btn btn-primary w-full"
      >
        {isLoading ? "Tap your chip now..." : isTxPending ? "Confirming transaction..." : "Tap Chip to Register"}
      </button>

      {status && (
        <div className="alert alert-info mt-4">
          <span>{status}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      )}

      {txError && (
        <div className="alert alert-error mt-4">
          <span>Transaction error: {txError.message}</span>
        </div>
      )}

      {isTxSuccess && (
        <div className="alert alert-success mt-4">
          <span>Chip registered successfully!</span>
        </div>
      )}
    </div>
  );
}
