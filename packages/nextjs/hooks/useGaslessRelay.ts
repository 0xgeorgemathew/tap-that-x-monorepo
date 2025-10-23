import { useChainId } from "wagmi";

export function useGaslessRelay() {
  const chainId = useChainId();

  const relayPayment = async (paymentData: any) => {
    const response = await fetch("/api/relay-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentData, chainId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Relay failed");
    }

    return await response.json();
  };

  const relayExecuteTap = async (executeData: {
    owner: string;
    chip: string;
    chipSignature: string;
    timestamp: number;
    nonce: string;
  }) => {
    const response = await fetch("/api/relay-execute-tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...executeData, chainId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Execution relay failed");
    }

    return await response.json();
  };

  return { relayPayment, relayExecuteTap };
}
