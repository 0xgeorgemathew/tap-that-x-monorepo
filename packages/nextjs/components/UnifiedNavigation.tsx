"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const navSteps = [
  { path: "/", label: "Home" },
  { path: "/register", label: "Register" },
  { path: "/approve", label: "Approve" },
  { path: "/payment", label: "Payment" },
];

export const UnifiedNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = navSteps.findIndex(step => step.path === pathname);
  const prevStep = currentIndex > 0 ? navSteps[currentIndex - 1] : null;
  const nextStep = currentIndex < navSteps.length - 1 ? navSteps[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-center gap-3 mt-5">
      {/* Previous Arrow */}
      {prevStep ? (
        <button
          onClick={() => router.push(prevStep.path)}
          className="nav-arrow"
          title={`Previous: ${prevStep.label}`}
          aria-label={`Go to ${prevStep.label}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}

      {/* Navigation Dots */}
      {navSteps.map(step => {
        const isActive = pathname === step.path;
        return <div key={step.path} className={`nav-dot ${isActive ? "nav-dot-active" : ""}`} title={step.label} />;
      })}

      {/* Next Arrow */}
      {nextStep ? (
        <button
          onClick={() => router.push(nextStep.path)}
          className="nav-arrow"
          title={`Next: ${nextStep.label}`}
          aria-label={`Go to ${nextStep.label}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}
    </div>
  );
};
