"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export const SwitchTheme = ({ className }: { className?: string }) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = resolvedTheme === "dark";

  const handleToggle = () => {
    if (isDarkMode) {
      setTheme("light");
      return;
    }
    setTheme("dark");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`flex space-x-1.5 h-6 items-center justify-center text-xs ${className}`}>
      <input
        id="theme-toggle"
        type="checkbox"
        className="toggle bg-secondary toggle-primary hover:bg-accent transition-all scale-75"
        onChange={handleToggle}
        checked={isDarkMode}
      />
      <label htmlFor="theme-toggle" className={`swap swap-rotate ${!isDarkMode ? "swap-active" : ""}`}>
        <Sun className="swap-on h-4 w-4" />
        <Moon className="swap-off h-4 w-4" />
      </label>
    </div>
  );
};
