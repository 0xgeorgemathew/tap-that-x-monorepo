import { type RegistrationStep as Step } from "./types";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "~~/lib/utils";

interface RegistrationStepProps {
  step: Step;
}

export function RegistrationStep({ step }: RegistrationStepProps) {
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
        "flex items-center gap-4 p-4 rounded-lg transition-all border-2",
        isActive && "bg-primary/10 border-primary",
        step.status === "complete" && "opacity-60 border-base-300",
        step.status === "idle" && "opacity-40 border-base-300",
      )}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-base text-base-content">{step.title}</h3>
        <p className="text-xs text-base-content/70 mt-0.5 font-medium">{step.description}</p>
      </div>
    </div>
  );
}
