"use client";

import { usePathname, useRouter } from "next/navigation";
import { CreditCard, Home, Nfc, Settings, Shield, Zap } from "lucide-react";

const navTabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/register", label: "Register", icon: Nfc },
  { path: "/approve", label: "Approve", icon: Shield },
  { path: "/configure", label: "Configure", icon: Settings },
  { path: "/execute", label: "Execute", icon: Zap },
  { path: "/payment-terminal", label: "Terminal", icon: CreditCard },
];

export const UnifiedNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4">
      <nav
        className="glass-navbar w-full max-w-6xl flex items-center justify-around px-6 py-3 rounded-full"
        role="navigation"
        aria-label="Main navigation"
      >
        {navTabs.map(tab => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`glass-nav-icon ${isActive ? "glass-nav-icon-active" : ""}`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={`h-6 w-6 ${isActive ? "text-[#5666F6] dark:text-[#A78BFA]" : "text-base-content/50"}`} />
            </button>
          );
        })}
      </nav>
    </div>
  );
};
