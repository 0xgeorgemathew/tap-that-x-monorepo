import { type PaymentStep as Step } from "./types";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "~~/lib/utils";

interface PaymentStepProps {
  step: Step;
}

export function PaymentStep({ step }: PaymentStepProps) {
  const getIcon = () => {
    switch (step.status) {
      case "loading":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "error":
        return <XCircle className="h-5 w-5 text-error" />;
      default:
        return <Circle className="h-5 w-5 text-base-content/30" />;
    }
  };

  const isActive = step.status === "loading" || step.status === "active";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg transition-all",
        isActive && "bg-primary/5 border-2 border-primary/20",
        step.status === "complete" && "opacity-60",
        step.status === "idle" && "opacity-40",
      )}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base text-base-content">{step.title}</h3>
        <p className="text-xs text-base-content/60 mt-0.5">{step.description}</p>
      </div>
    </div>
  );
}
