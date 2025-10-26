"use client";

import { useHaloChip } from "./useHaloChip";
import { useChainId } from "wagmi";

export interface PaymentAuthorizationParams {
  payerAddress: string;
  payerChipAddress: string;
  payeeAddress: string;
  payeeChipAddress: string;
  tokenAddress: string;
  amount: bigint;
}

export function usePaymentTerminal(terminalContractAddress: `0x${string}`) {
  const chainId = useChainId();
  const { signTypedData } = useHaloChip();

  /**
   * Execute payment by having customer chip sign authorization and relay to contract
   */
  const executePayment = async (params: PaymentAuthorizationParams) => {
    // Generate timestamp and nonce
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")}` as `0x${string}`;

    // Build EIP-712 typed data for PaymentAuthorization
    const domain = {
      name: "TapThatXPaymentTerminal",
      version: "1",
      verifyingContract: terminalContractAddress,
    };

    const types = {
      PaymentAuthorization: [
        { name: "payer", type: "address" },
        { name: "payerChip", type: "address" },
        { name: "payee", type: "address" },
        { name: "payeeChip", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const message = {
      payer: params.payerAddress,
      payerChip: params.payerChipAddress,
      payee: params.payeeAddress,
      payeeChip: params.payeeChipAddress,
      token: params.tokenAddress,
      amount: params.amount,
      timestamp: BigInt(timestamp),
      nonce: nonce,
    };

    // Customer taps chip to sign authorization
    const { signature: payerSignature } = await signTypedData({
      domain,
      types,
      primaryType: "PaymentAuthorization",
      message,
    });

    // Send to relay API for execution
    const response = await fetch("/api/relay-execute-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: params.payerAddress,
        payerChip: params.payerChipAddress,
        payee: params.payeeAddress,
        payeeChip: params.payeeChipAddress,
        token: params.tokenAddress,
        amount: params.amount.toString(),
        timestamp,
        nonce,
        payerSignature,
        chainId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment execution failed");
    }

    return await response.json();
  };

  return { executePayment };
}
