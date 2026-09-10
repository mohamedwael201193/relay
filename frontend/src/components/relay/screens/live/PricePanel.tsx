"use client";

/**
 * RELAY — the price chart panel (left/center column).
 * Underlying price line + stat header, and the resolution narrative layered
 * on top of the chart: ORACLE ANSWERING → outcome flash → CLAIMED strip.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRelay } from "@/lib/relay/engine/store";
import { Panel, PriceLine } from "@/components/relay/core/primitives";
import { DownMark, UpMark, VerifiedSeal } from "@/components/relay/identity/identity";
import { cents, price as fmtPrice, shortHash, signed, signedPct } from "@/lib/relay/format";
import { explorerTxUrl } from "@/lib/relay/config/network";
import type { LapResult } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { entryUpTerms, pctChange, useFlash } from "./helpers";

export function PricePanel({ className }: { className?: string }) {
  const lap = useRelay((s) => s.liveLap);
  const priceHistory = useRelay((s) => s.priceHistory);
  const lastResult = useRelay((s) => s.lastResult);
  const flash = useFlash(lap?.price ?? 0);

  if (!lap) return null;
  const { market, phase, position, probUp, price } = lap;
  const delta = pctChange(price, market.openPrice);
  const entry = entryUpTerms(position?.entryPrice, position?.side);
  const priceColor =
    flash.tone === "up" ? "text-lime" : flash.tone === "down" ? "text-ember" : "text-cream";

  return (
    <Panel label={`UNDERLYING · ${market.asset}`} className={className}>
      {/* stat header */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-5 pt-3.5 pb-2">
        <div>
          <div className="mlabel text-foam/70">PRICE</div>
          <div
            key={flash.key}
            className={cn("data text-2xl font-semibold leading-none mt-1 transition-colors duration-300", priceColor)}
          >
            {fmtPrice(price, market.asset)}
          </div>
        </div>
        <div>
          <div className="mlabel text-foam/70">OPEN</div>
          <div className="data text-2xl font-semibold leading-none mt-1 text-cream/80">
            {fmtPrice(market.openPrice, market.asset)}
          </div>
        </div>
        <div>
          <div className="mlabel text-foam/70">Δ VS OPEN</div>
          <div
            className={cn(
              "data text-2xl font-semibold leading-none mt-1",
              delta > 0 ? "text-lime" : delta < 0 ? "text-ember" : "text-cream/80"
            )}
          >
            {price > 0 && market.openPrice > 0 ? signedPct(delta) : "—"}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="mlabel text-foam/70">IMPLIED UP</div>
          <div className="data text-2xl font-semibold leading-none mt-1 text-flame">
            {Number.isFinite(probUp) && probUp > 0 ? cents(probUp) : "—"}
          </div>
        </div>
      </div>

      {/* chart + resolution overlays */}
      <div className="relative px-2 pb-3">
        <div className="hidden sm:block">
          <PriceLine points={priceHistory} open={market.openPrice} entry={entry} height={200} />
        </div>
        <div className="sm:hidden">
          <PriceLine points={priceHistory} open={market.openPrice} entry={entry} height={160} />
        </div>

        <AnimatePresence>
          {phase === "ORACLE" && <OracleBand key="oracle-band" />}
          {phase === "RESULT" && lastResult && <ResultFlash key="result-flash" r={lastResult} />}
          {phase === "CLAIM" && lastResult && <ClaimStrip key="claim-strip" r={lastResult} />}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

/* ── ORACLE: the answering band ─────────────────────────────── */

function OracleBand() {
  return (
    <motion.div
      className="absolute inset-x-3 top-1/2 -translate-y-1/2 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-center gap-4 sm:gap-5 rounded-2xl border-2 px-4 sm:px-6 py-4"
        style={{
          borderColor: "rgba(255,178,36,0.55)",
          background: "rgba(255,178,36,0.10)",
          backdropFilter: "blur(4px)",
        }}
        initial={{ y: 12 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <OracleSeal />
        <div className="min-w-0">
          <div
            className="data text-xl sm:text-2xl font-bold wide tracking-tight"
            style={{ color: "#ffb224", fontFamily: "var(--font-display)" }}
          >
            ORACLE ANSWERING
          </div>
          <div className="mlabel text-foam mt-1.5">AnswerDelivered · SOMNIA REACTIVITY</div>
        </div>
        <span className="ml-auto data text-2xl font-semibold text-foam/50 hidden sm:block" aria-hidden>
          00:00
        </span>
      </motion.div>
    </motion.div>
  );
}

/** Rotating seal motif — flame ring carrying the answer in. */
function OracleSeal() {
  return (
    <div className="relative w-14 h-14 sm:w-16 sm:h-16 grid place-items-center shrink-0" aria-hidden>
      <motion.svg
        viewBox="0 0 64 64"
        className="absolute inset-0 w-full h-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
      >
        <circle cx="32" cy="32" r="28" fill="none" stroke="#ffb224" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#ffb224" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="32" cy="4" r="3" fill="#ffb224" />
      </motion.svg>
      <span className="w-2.5 h-2.5 rounded-full bg-flame blink" />
    </div>
  );
}

/* ── RESULT: the outcome flash ──────────────────────────────── */

function ResultFlash({ r }: { r: LapResult }) {
  const win = r.outcome === "WIN";
  const voided = r.outcome === "VOID";
  const color = win ? "#aae83c" : voided ? "#b3a98f" : "#f0512a";

  return (
    <motion.div
      className="absolute inset-0 z-10 grid place-items-center rounded-2xl"
      style={{ background: "rgba(20,17,10,0.93)" }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center px-4 py-2">
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {!voided &&
            (win ? (
              <UpMark className="w-9 h-9 sm:w-12 sm:h-12" />
            ) : (
              <DownMark className="w-9 h-9 sm:w-12 sm:h-12" />
            ))}
          <motion.span
            className="font-black wider text-5xl sm:text-6xl leading-none tracking-tight"
            style={{ color, fontFamily: "var(--font-display)" }}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {win ? "WIN" : voided ? "VOID" : "LOSS"}
          </motion.span>
        </div>
        {voided ? (
          <div className="mlabel text-foam mt-2.5">STAKE RETURNED</div>
        ) : (
          <div className="data text-2xl font-semibold mt-2.5" style={{ color }} aria-live="polite">
            {signed(r.pnl)}
          </div>
        )}
        <div className="data text-xs text-foam mt-3">
          {r.asset} closed {fmtPrice(r.closePrice, r.asset)} vs open{" "}
          {fmtPrice(r.openPrice, r.asset)}
        </div>
      </div>
    </motion.div>
  );
}

/* ── CLAIM: the receipt strip ───────────────────────────────── */

function ClaimStrip({ r }: { r: LapResult }) {
  return (
    <motion.div
      className="absolute inset-x-3 bottom-2.5 z-10"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <div
        className="flex items-center gap-4 rounded-2xl border-2 px-4 py-3"
        style={{
          borderColor: "rgba(170,232,60,0.55)",
          background: "rgba(170,232,60,0.10)",
          backdropFilter: "blur(4px)",
        }}
      >
        <motion.div
          initial={{ rotate: -10, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
        >
          <VerifiedSeal size={56} label="CLAIMED" />
        </motion.div>
        <div className="min-w-0 text-left">
          <div
            className="data text-lg font-bold wide text-lime tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CLAIMED · 0 CLICKS
          </div>
          <a
            href={explorerTxUrl(r.proof.claimTx) ?? "#"}
            target={explorerTxUrl(r.proof.claimTx) ? "_blank" : undefined}
            rel={explorerTxUrl(r.proof.claimTx) ? "noopener noreferrer" : undefined}
            onClick={explorerTxUrl(r.proof.claimTx) ? undefined : (e) => e.preventDefault()}
            className="data text-xs text-foam underline decoration-lined underline-offset-2 hover:text-cream hover:decoration-cream transition-colors"
            aria-label="Claim transaction, Shannon explorer"
          >
            {shortHash(r.proof.claimTx)}
          </a>
        </div>
        <span className="ml-auto mlabel text-foam/60 hidden sm:block">REACTIVITY SETTLED</span>
      </div>
    </motion.div>
  );
}
