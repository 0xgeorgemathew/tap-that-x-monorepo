export type StepStatus = "idle" | "active" | "loading" | "complete" | "error";

export interface RegistrationStep {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
}

export const REGISTRATION_STEPS: Omit<RegistrationStep, "status">[] = [
  { id: 1, title: "Detect Chip", description: "Tap your NFC chip to read address" },
  { id: 2, title: "Sign Registration", description: "Tap again to authorize" },
  { id: 3, title: "Confirm Transaction", description: "Complete on-chain registration" },
];
