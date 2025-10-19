"use client";

import dynamic from "next/dynamic";

const Aurora = dynamic(() => import("./Aurora"), { ssr: false });

export function OrbBackground() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <Aurora colorStops={["#3A29FF", "#FF94B4", "#FF3232"]} blend={0.46} amplitude={1.0} speed={0.7} />
    </div>
  );
}
