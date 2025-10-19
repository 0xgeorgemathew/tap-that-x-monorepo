"use client";

import Link from "next/link";
import { ArrowRight, Nfc } from "lucide-react";
import type { NextPage } from "next";
import { UnifiedNavigation } from "~~/components/UnifiedNavigation";

const Home: NextPage = () => {
  return (
    <div className="min-h-screen flex items-start justify-center pt-24 md:pt-32 p-4 sm:p-6 gradient-bg">
      <div className="w-full max-w-lg">
        {/* Main Glass Card */}
        <div className="glass-card p-6 sm:p-8 md:p-10 flex flex-col">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="round-icon w-20 h-20 sm:w-24 sm:h-24 mb-5">
              <Nfc className="h-12 w-12 sm:h-14 sm:w-14 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content mb-2">NFC Chip Registry</h1>
            <p className="text-sm sm:text-base text-base-content/80 font-medium px-4">
              Securely register and authenticate NFC chips on-chain with cryptographic proof of ownership
            </p>
          </div>

          {/* Dynamic Content Area */}
          <div className="space-y-5 sm:space-y-6 flex flex-col min-h-[120px]">
            {/* Empty content area for layout consistency */}
          </div>

          {/* Action Button - Fixed position */}
          <div className="mt-4 space-y-4">
            <Link
              href="/register"
              className="glass-btn flex items-center justify-center gap-3 w-full hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Register Your Chip</span>
              <ArrowRight className="h-5 w-5" />
            </Link>

            {/* Help Text */}
            <p className="text-xs sm:text-sm text-center text-base-content/60 px-2">
              Start by registering your NFC chip to your wallet
            </p>
          </div>

          <UnifiedNavigation />
        </div>
      </div>
    </div>
  );
};

export default Home;
