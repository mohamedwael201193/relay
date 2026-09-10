"use client";

/**
 * RELAY — empty tape state.
 * A dashed receipt illustration waiting for its first line, with the
 * right CTA for the runner's current status.
 */

import { motion } from "framer-motion";
import { Rocket, Radio } from "lucide-react";
import type { Runner } from "@/lib/relay/types";
import { useRelay } from "@/lib/relay/engine/store";
import { cn } from "@/lib/utils";

function ReceiptArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 240"
      width="170"
      height="204"
      className={className}
      aria-hidden
      fill="none"
    >
      {/* torn-edge receipt body */}
      <path
        d="M24 8h152v214l-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8V8z"
        fill="#1e1a10"
        stroke="#3a3320"
        strokeWidth="2.5"
      />
      {/* masthead */}
      <line x1="44" y1="30" x2="156" y2="30" stroke="#b3a98f" strokeWidth="2" strokeDasharray="8 6" opacity="0.7" />
      <rect x="56" y="42" width="88" height="10" rx="2" fill="none" stroke="#b3a98f" strokeWidth="1.6" strokeDasharray="4 4" opacity="0.8" />
      {/* dashed placeholder rows */}
      {[70, 94, 118, 142, 166].map((y) => (
        <g key={y} opacity="0.75">
          <rect x="40" y={y} width="34" height="8" rx="2" stroke="#3a3320" strokeWidth="1.6" strokeDasharray="3 3" />
          <rect x="82" y={y} width="52" height="8" rx="2" stroke="#3a3320" strokeWidth="1.6" strokeDasharray="3 3" />
          <rect x="142" y={y} width="22" height="8" rx="2" stroke="#3a3320" strokeWidth="1.6" strokeDasharray="3 3" />
        </g>
      ))}
      {/* seal placeholder */}
      <circle cx="100" cy="202" r="17" stroke="#ffb224" strokeWidth="2" strokeDasharray="5 5" opacity="0.75" />
      <path d="M94 202l4.5 4.5 8-9" stroke="#ffb224" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
    </svg>
  );
}

export function EmptyTape({ runner }: { runner: Runner | null }) {
  const goScreen = useRelay((s) => s.goScreen);
  const dead = !runner || runner.status === "STOPPED";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-6 px-6 py-14 text-center"
    >
      <ReceiptArt className="opacity-90" />
      <div>
        <h2 className="text-2xl font-black wide leading-tight text-cream">
          The tape starts with your first lap.
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foam">
          No settled laps yet. When a window closes, the oracle answers and the
          claim lands, the receipt appears here — fill, settlement and proof.
        </p>
      </div>
      {dead ? (
        <button
          type="button"
          onClick={() => goScreen("deploy")}
          className={cn(
            "mlabel inline-flex items-center gap-2 rounded-lg border-2 border-lime bg-lime px-5 py-3 text-graphite",
            "hardshadow-d transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
          )}
        >
          <Rocket className="h-4 w-4" aria-hidden />
          DEPLOY RUNNER
        </button>
      ) : (
        <button
          type="button"
          onClick={() => goScreen("live")}
          className={cn(
            "mlabel inline-flex items-center gap-2 rounded-lg border-2 border-lined bg-panel2 px-5 py-3 text-cream",
            "transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          )}
        >
          <Radio className="h-4 w-4" aria-hidden />
          WATCH THE LIVE LAP
        </button>
      )}
    </motion.div>
  );
}
