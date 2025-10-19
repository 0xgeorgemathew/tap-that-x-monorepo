"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const navFlow = [
  { path: "/", label: "Home" },
  { path: "/register", label: "Register" },
  { path: "/approve", label: "Approve" },
  { path: "/payment", label: "Payment" },
];

export const NavigationArrows = () => {
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = navFlow.findIndex(step => step.path === pathname);
  const prevStep = currentIndex > 0 ? navFlow[currentIndex - 1] : null;
  const nextStep = currentIndex < navFlow.length - 1 ? navFlow[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      {/* Previous Button */}
      {prevStep ? (
        <button onClick={() => router.push(prevStep.path)} className="nav-arrow" title={`Previous: ${prevStep.label}`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}

      {/* Next Button */}
      {nextStep ? (
        <button onClick={() => router.push(nextStep.path)} className="nav-arrow" title={`Next: ${nextStep.label}`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}
    </div>
  );
};
