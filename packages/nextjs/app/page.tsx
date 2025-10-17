"use client";

import Link from "next/link";
import { ArrowRight, Nfc } from "lucide-react";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-200">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-xl bg-primary mb-8 border-4 border-primary">
            <Nfc className="h-20 w-20 text-primary-content" aria-hidden="true" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-base-content">NFC Chip Registry</h1>
          <p className="text-lg md:text-xl text-base-content/80 max-w-2xl mx-auto mb-8 font-medium">
            Securely register and authenticate NFC chips on-chain with cryptographic proof of ownership
          </p>

          <Link href="/register" className="btn btn-primary btn-lg h-14 px-8 gap-3 text-base font-bold">
            <span>Register Your Chip</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
