"use client";

import { CheckCircle2 } from "lucide-react";

export interface Step {
  label: string;
  description?: string;
  timeEstimate?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export const StepIndicator = ({ steps, currentStep, className = "" }: StepIndicatorProps) => {
  return (
    <div
      className={`step-indicator-container ${className}`}
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={index} className="step-indicator-item">
            {/* Step Number / Check Circle */}
            <div className="step-indicator-circle-wrapper">
              <div
                className={`step-indicator-circle ${
                  isCompleted
                    ? "step-indicator-circle-completed"
                    : isCurrent
                      ? "step-indicator-circle-current"
                      : "step-indicator-circle-upcoming"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                ) : (
                  <span className="text-sm sm:text-base font-bold leading-none">{index + 1}</span>
                )}
              </div>
            </div>

            {/* Step Content */}
            <div className="step-indicator-content">
              <div
                className={`step-indicator-label ${
                  isCurrent
                    ? "step-indicator-label-current"
                    : isCompleted
                      ? "step-indicator-label-completed"
                      : "step-indicator-label-upcoming"
                }`}
              >
                {step.label}
              </div>
              {step.description && isCurrent && <div className="step-indicator-description">{step.description}</div>}
              {step.timeEstimate && isCurrent && <div className="step-indicator-time">Est. {step.timeEstimate}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
