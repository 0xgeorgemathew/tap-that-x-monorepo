"use client";

import Link from "next/link";
import { ArrowRight, Nfc } from "lucide-react";
import type { NextPage } from "next";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";

const Home: NextPage = () => {
  return (
    <div className="flex items-start justify-center p-4 sm:p-6 pb-24">
      <div className="w-full max-w-lg">
        {/* Main Glass Card */}
        <div className="glass-card p-4 sm:p-6 md:p-8 flex flex-col">
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            <div className="round-icon w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-4">
              <Nfc className="h-12 w-12 sm:h-14 sm:w-14 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">NFC Chip Registry</h1>
            <p className="text-sm sm:text-base text-base-content/80 font-medium px-4">
              Securely register and authenticate NFC chips on-chain with cryptographic proof of ownership
            </p>
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-3 sm:space-y-4 md:space-y-5 flex flex-col min-h-[100px] sm:min-h-[140px]">
            {/* Empty content area for layout consistency */}
          </div>

          {/* Action Button - Fixed position */}
          <div className="mt-4 sm:mt-6 space-y-4">
            <Link
              href="/register"
              className="glass-btn flex items-center justify-center gap-3 w-full hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Register Your Chip</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      <UnifiedNavigation />
    </div>
  );
};

export default Home;
