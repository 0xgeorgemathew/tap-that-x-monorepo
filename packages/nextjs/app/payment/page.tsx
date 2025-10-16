"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useSignTypedData } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useGaslessRelay } from "~~/hooks/useGaslessRelay";
import { useHaloChip } from "~~/hooks/useHaloChip";

export default function PaymentPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Get contract addresses for current chain
  const contracts = deployedContracts[chainId as keyof typeof deployedContracts];
  const PAYMENT_PROCESSOR = contracts?.USDCPaymentProcessor?.address;
  const USDC = contracts?.MockUSDC?.address;
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { signTypedData } = useHaloChip();
  const { signTypedDataAsync } = useSignTypedData();
  const { relayPayment } = useGaslessRelay();

  const handlePayment = async () => {
    if (!address || !publicClient) {
      alert("Please connect your wallet first");
      return;
    }

    if (!PAYMENT_PROCESSOR || !USDC) {
      alert("Contracts not deployed on this network");
      return;
    }

    if (!recipient || !amount) {
      alert("Please enter recipient and amount");
      return;
    }

    setIsProcessing(true);
    setStatus("Preparing payment...");

    try {
      const amountWei = parseUnits(amount, 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      // 1. Tap chip to authorize payment
      setStatus("Tap your chip to authorize...");
      const chipSig = await signTypedData({
        domain: {
          name: "USDCPaymentProcessor",
          version: "1",
          chainId,
          verifyingContract: PAYMENT_PROCESSOR,
        },
        types: {
          PaymentAuth: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "PaymentAuth",
        message: {
          from: address,
          to: recipient as `0x${string}`,
          amount: amountWei,
          timestamp: BigInt(timestamp),
          nonce,
        },
      });

      // 2. Sign USDC permit
      setStatus("Sign USDC permit in wallet...");
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const permitNonce = await publicClient.readContract({
        address: USDC,
        abi: contracts.MockUSDC.abi,
        functionName: "nonces",
        args: [address],
      });

      const permitSig = await signTypedDataAsync({
        domain: {
          name: "USD Coin",
          version: "1",
          chainId,
          verifyingContract: USDC,
        },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        message: {
          owner: address,
          spender: PAYMENT_PROCESSOR,
          value: amountWei,
          nonce: permitNonce as bigint,
          deadline: BigInt(deadline),
        },
      });

      const r = permitSig.slice(0, 66) as `0x${string}`;
      const s = ("0x" + permitSig.slice(66, 130)) as `0x${string}`;
      const v = parseInt(permitSig.slice(130, 132), 16);

      // 3. Relay to backend
      setStatus("Relaying transaction...");
      await relayPayment({
        owner: address,
        recipient,
        amount: amountWei.toString(),
        deadline,
        permitSignature: { v, r, s },
        chipSignature: chipSig.signature,
        timestamp,
        nonce,
      });

      setStatus("Payment successful!");
      setRecipient("");
      setAmount("");
    } catch (err) {
      console.error("Payment failed:", err);
      setStatus(`Error: ${err instanceof Error ? err.message : "Payment failed"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Tap to Pay</h1>

      {!address && (
        <div className="alert alert-warning mb-4">
          <span>Please connect your wallet to make payments</span>
        </div>
      )}

      <input
        type="text"
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
        placeholder="Recipient address"
        className="input input-bordered w-full mb-4"
        disabled={isProcessing}
      />

      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount (USDC)"
        className="input input-bordered w-full mb-4"
        disabled={isProcessing}
      />

      <button onClick={handlePayment} disabled={isProcessing || !address} className="btn btn-primary w-full">
        {isProcessing ? "Processing..." : `Pay ${amount || "0"} USDC`}
      </button>

      {status && (
        <div
          className={`alert mt-4 ${status.includes("Error") ? "alert-error" : status.includes("successful") ? "alert-success" : "alert-info"}`}
        >
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}
