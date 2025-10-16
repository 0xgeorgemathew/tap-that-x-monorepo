"use client";

import { useState } from "react";
import { execHaloCmdWeb } from "@arx-research/libhalo/api/web";

export function ChipReader() {
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const readChip = async () => {
    setIsReading(true);
    setError(null);
    setResult(null);

    try {
      const res = await execHaloCmdWeb({ name: "get_pkeys" });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read chip");
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={readChip} disabled={isReading} className="btn btn-primary w-full">
        {isReading ? "Tap your chip now..." : "Read Chip"}
      </button>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Ethereum Address</div>
          <code className="block p-2 bg-base-200 rounded text-xs break-all">
            {result.etherAddresses?.["1"] ?? "N/A"}
          </code>

          <div className="text-sm font-semibold">Public Key 1</div>
          <code className="block p-2 bg-base-200 rounded text-xs break-all">{result.publicKeys?.["1"] ?? "N/A"}</code>
        </div>
      )}
    </div>
  );
}
