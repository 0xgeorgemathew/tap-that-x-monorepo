import { type PaymentStep } from "./types";
import { Badge } from "~~/components/ui/badge";
import { Progress } from "~~/components/ui/progress";

interface PaymentStepIndicatorProps {
  steps: PaymentStep[];
  currentStep: number;
}

export function PaymentStepIndicator({ steps, currentStep }: PaymentStepIndicatorProps) {
  const progress = (currentStep / steps.length) * 100;
  const activeStep = steps[currentStep - 1];

  const getStatusBadge = () => {
    if (!activeStep) return null;

    switch (activeStep.status) {
      case "loading":
        return <Badge variant="default">In Progress</Badge>;
      case "complete":
        return <Badge variant="success">Complete</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
      default:
        return (
          <Badge variant="outline">
            Step {currentStep} of {steps.length}
          </Badge>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-base-content">{activeStep?.title || "Payment"}</h2>
          <p className="text-sm text-base-content/60 mt-1">{activeStep?.description || "Follow the steps below"}</p>
        </div>
        {getStatusBadge()}
      </div>

      <Progress value={progress} className="h-2" />
    </div>
  );
}
