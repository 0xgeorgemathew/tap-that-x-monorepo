"use client";

import { useState } from "react";
import { execHaloCmdWeb } from "@arx-research/libhalo/api/web";

export function useHaloChip() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signMessage = async ({ message, format }: { message: string; format?: "text" | "hex" }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        message,
        ...(format && { format }),
      });
      return {
        address: result.etherAddress,
        signature: result.signature.raw, // Use .raw for EIP-191 messages
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
      const result = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        typedData: { domain, types, primaryType, message },
      });
      return {
        address: result.etherAddress,
        signature: result.signature.raw, // Use .raw for EIP-712 typed data
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "NFC read failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { signMessage, signTypedData, isLoading, error };
}
