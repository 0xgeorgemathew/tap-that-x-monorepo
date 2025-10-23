"use client";

import { usePathname } from "next/navigation";

const navSteps = [
  { path: "/", label: "Home" },
  { path: "/register", label: "Register" },
  { path: "/approve", label: "Approve" },
  { path: "/configure", label: "Configure" },
  { path: "/execute", label: "Execute" },
];

export const NavigationDots = () => {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {navSteps.map(step => {
        const isActive = pathname === step.path;
        return <div key={step.path} className={`nav-dot ${isActive ? "nav-dot-active" : ""}`} title={step.label} />;
      })}
    </div>
  );
};
