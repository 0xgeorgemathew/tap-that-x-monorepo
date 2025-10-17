export type PaymentStepStatus = "idle" | "active" | "loading" | "complete" | "error";

export interface PaymentStep {
  id: number;
  title: string;
  description: string;
  status: PaymentStepStatus;
}

export const PAYMENT_STEPS: Omit<PaymentStep, "status">[] = [
  {
    id: 1,
    title: "Detect Chip",
    description: "Tap your NFC chip to detect recipient",
  },
  {
    id: 2,
    title: "Complete Payment",
    description: "Authorize and process the transaction",
  },
];
