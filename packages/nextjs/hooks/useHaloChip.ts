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
      const result = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        typedData: { domain, types, primaryType, message },
      });
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

  return { signMessage, signTypedData, isLoading, error };
}
