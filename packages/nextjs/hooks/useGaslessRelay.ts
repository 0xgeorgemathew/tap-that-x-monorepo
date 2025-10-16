export function useGaslessRelay() {
  const relayPayment = async (paymentData: any) => {
    const response = await fetch("/api/relay-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Relay failed");
    }

    return await response.json();
  };

  return { relayPayment };
}
