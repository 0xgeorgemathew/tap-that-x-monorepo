"use client";

import { useState } from "react";
import { execHaloCmdWeb } from "@arx-research/libhalo/api/web";

export function useHaloChip() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signMessage = async ({
    message,
    digest,
    format,
  }: {
    message?: string;
    digest?: string;
    format?: "text" | "hex";
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const command: any = {
        name: "sign",
        keyNo: 1,
      };

      // Use either message (with optional format) or digest (raw hash)
      if (digest) {
        command.digest = digest;
      } else if (message) {
        command.message = message;
        if (format) {
          command.format = format;
        }
      } else {
        throw new Error("Either message or digest must be provided");
      }

      const result = await execHaloCmdWeb(command);
      return {
        address: result.etherAddress,
        signature: result.signature.ether, // Ethereum-formatted signature string
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "NFC read failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signTypedData = async ({ domain, types, primaryType, message }: any) => {
    setIsLoading(true);
    setError(null);
    try {
      // HaloTag EIP-712 requires specific structure with EIP712Domain type
      const typedDataPayload = {
        domain,
        types: {
          ...types,
          // EIP712Domain must be explicitly defined
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
        },
        primaryType,
        message, // HaloTag uses 'message', not 'value'
      };

      console.log("📝 EIP-712 Typed Data Payload:", JSON.stringify(typedDataPayload, null, 2));

      const result = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        typedData: typedDataPayload,
      });

      console.log("✅ HaloTag signature result:", result);

      return {
        address: result.etherAddress,
        signature: result.signature.ether,
      };
    } catch (err) {
      console.error("❌ HaloTag signTypedData error:", err);
      const msg = err instanceof Error ? err.message : "NFC read failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { signMessage, signTypedData, isLoading, error };
}
