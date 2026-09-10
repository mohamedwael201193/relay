"use client";

/**
 * RELAY — SETTINGS.
 * The control center: money safety first (runner control), then policy
 * (risk), the guarantees (safety), the keys (wallet), and the dev demo
 * door. You hold the keys — the runner holds nothing it can keep.
 */

import { MotionConfig } from "framer-motion";
import { KeyRound } from "lucide-react";

import { RunnerControlSection } from "./settings/runner-control";
import { RiskPolicySection } from "./settings/risk-policy";
import { DemoSection, SafetySection, WalletSection } from "./settings/wallet-about";

export function SettingsScreen() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        {/* ── header ── */}
        <header>
          <div className="flex items-center gap-2">
            <KeyRound className="size-3.5 text-foam" aria-hidden />
            <span className="mlabel text-foam">SETTINGS</span>
          </div>
          <h1 className="mt-2 text-3xl font-black wide leading-[0.95] tracking-[-0.01em] sm:text-4xl">
            You hold the keys.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foam">
            Everything here is yours alone: the runner can trade inside its bounds
            and nothing else.
          </p>
        </header>

        {/* ── sections ── */}
        <div className="mt-6 grid gap-5">
          <RunnerControlSection />
          <RiskPolicySection />
          <div className="grid gap-5 lg:grid-cols-2">
            <SafetySection />
            <WalletSection />
          </div>
          <DemoSection />
        </div>
      </div>
    </MotionConfig>
  );
}
