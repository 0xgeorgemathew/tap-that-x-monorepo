"use client";

import Link from "next/link";
import { ArrowRight, Nfc, Shield, Zap } from "lucide-react";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary mb-6">
            <Nfc className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            NFC Chip Registry
          </h1>
          <p className="text-lg md:text-xl text-base-content/70 max-w-2xl mx-auto mb-8">
            Securely register and authenticate NFC chips on-chain with cryptographic proof of ownership
          </p>

          <Link href="/register" className="btn btn-primary btn-lg h-14 px-8 gap-3 text-base">
            <span>Register Your Chip</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="card bg-base-100 shadow-lg border border-base-300">
            <div className="card-body p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg mb-2">Cryptographic Security</h3>
              <p className="text-sm text-base-content/70">
                Each chip signs with its own private key, providing cryptographic proof of ownership on-chain
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg border border-base-300">
            <div className="card-body p-6">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-secondary" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg mb-2">Simple & Fast</h3>
              <p className="text-sm text-base-content/70">
                Register your chip in seconds with just two NFC taps - no complex setup required
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
