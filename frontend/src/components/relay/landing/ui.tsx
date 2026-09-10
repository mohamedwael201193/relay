"use client";

/**
 * RELAY landing — shared editorial primitives (paper world only).
 * Reveal (in-view fade + rise), section heads, CTA class strings, and the
 * landing-scoped motion CSS (ambient, reduced-motion safe).
 */

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── CTA class strings ──────────────────────────────────────── */

export const ctaPrimary = cn(
  "data text-base font-semibold uppercase tracking-[0.12em] select-none",
  "px-8 py-4 rounded-xl border-2 border-ink bg-lime text-graphite hardshadow btn-raise",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
);

export const ctaInk = cn(
  "mlabel select-none inline-flex items-center gap-2",
  "px-5 py-3 rounded-xl border-2 border-ink bg-ink text-paper hardshadow-sm btn-raise",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
);

export const ctaLink = cn(
  "mlabel select-none inline-flex items-center gap-2 rounded-sm",
  "text-ink underline underline-offset-[7px] decoration-2 decoration-ink hover:decoration-flame transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
);

export const focusRing = cn(
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
);

/* ── in-view reveal (fade + rise 24px, stagger via delay) ───── */

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: reduce ? 0 : delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── section head ───────────────────────────────────────────── */

export function SectionHead({
  kicker,
  title,
  center = false,
}: {
  kicker: string;
  title: ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal className={cn(center && "text-center")}>
      <div className={cn("flex items-center gap-3", center && "justify-center")}>
        <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-lime border border-ink" aria-hidden />
        <span className="mlabel text-ink2">{kicker}</span>
      </div>
      <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.6rem)] font-black wide leading-[0.98] tracking-[-0.01em]">
        {title}
      </h2>
    </Reveal>
  );
}

/* ── landing-scoped motion CSS (once per page) ──────────────── */

export function LandingMotionStyles() {
  return (
    <style>{`
/* RELAY landing — local motion (ambient, reduced-motion safe) */
@keyframes relay-lane { to { stroke-dashoffset: -140; } }
.lane-flow { animation: relay-lane 1.6s linear infinite; }

@keyframes relay-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
.runner-bob { animation: relay-bob 1.35s ease-in-out infinite; }

@keyframes relay-baton-fly {
  0% { left: 0%; opacity: 0; }
  14% { opacity: 1; }
  86% { opacity: 1; }
  100% { left: calc(100% - 52px); opacity: 0; }
}
.baton-fly { position: absolute; left: 0; animation: relay-baton-fly 3.2s ease-in-out infinite; }

@keyframes relay-loop-run {
  0% { left: 2%; opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { left: calc(96% - 34px); opacity: 0; }
}
.loop-run { position: absolute; left: 2%; animation: relay-loop-run 8s linear infinite; }

/* CTA hardshadow interplay: lift + shadow grows */
.btn-raise { transition: transform 0.16s ease, box-shadow 0.16s ease; }
.btn-raise:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 0 #1a1610; }
.btn-raise:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 0 #1a1610; }

/* keep the hero display line on the paper at very small widths */
@media (max-width: 420px) {
  .hero-h1 { font-stretch: 100% !important; }
}

@media (prefers-reduced-motion: reduce) {
  .lane-flow,
  .runner-bob,
  .baton-fly,
  .loop-run { animation: none !important; }
  .btn-raise,
  .btn-raise:hover,
  .btn-raise:active { transition: none; transform: none; }
}
`}</style>
  );
}
