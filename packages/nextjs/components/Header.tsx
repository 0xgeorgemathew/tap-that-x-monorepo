"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Register Chip",
    href: "/register",
  },
  {
    label: "Payment",
    href: "/payment",
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive
                  ? "bg-primary text-primary-content border-2 border-primary font-bold"
                  : "border-2 border-transparent"
              } hover:bg-primary/10 hover:border-primary focus:!bg-primary/10 active:!text-neutral py-1.5 px-3 text-sm rounded-lg gap-2 grid grid-flow-col transition-all`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <nav className="glass-navbar w-full max-w-6xl flex items-center justify-between px-6 py-3 rounded-full">
        {/* Left: Logo + Brand */}
        <Link href="/" passHref className="flex items-center gap-3 shrink-0">
          <div className="flex relative w-8 h-8">
            <Image alt="TapThat X logo" className="cursor-pointer" fill src="/logo.svg" />
          </div>
          <span className="font-bold text-base leading-tight">TapThat X</span>
        </Link>

        {/* Right: Nav Links + Actions */}
        <div className="flex items-center gap-6">
          <ul className="hidden md:flex items-center gap-2">
            <HeaderMenuLinks />
          </ul>
          <div className="flex items-center gap-3">
            <RainbowKitCustomConnectButton />
            {isLocalNetwork && <FaucetButton />}
          </div>
        </div>
      </nav>
    </div>
  );
};
