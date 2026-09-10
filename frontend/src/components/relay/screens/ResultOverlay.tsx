"use client";

/**
 * RELAY — the RESULT OVERLAY.
 * The emotional moment of the product: a full-screen takeover when a lap
 * settles on-chain. Loud on wins, dignified on losses, calm on voids.
 * Auto-dismisses when the baton passes to the next lap.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useRelay } from "@/lib/relay/engine/store";
import { LiveDot, StatTile } from "@/components/relay/core/primitives";
import {
  AssetIcon,
  DownMark,
  FlameMark,
  ShieldMark,
  UpMark,
  VerifiedSeal,
} from "@/components/relay/identity/identity";
import { money, price as fmtPrice, shortHash, signed } from "@/lib/relay/format";
import { explorerTxUrl } from "@/lib/relay/config/network";
import { CountUp } from "./live/CountUp";
import { cn } from "@/lib/utils";
import type { LapResult } from "@/lib/relay/types";

export function ResultOverlay() {
  const resultOpen = useRelay((s) => s.resultOpen);
  const lastResult = useRelay((s) => s.lastResult);
  const dismiss = useRelay((s) => s.dismissResult);
  const goScreen = useRelay((s) => s.goScreen);
  const baton = useRelay((s) => s.baton);
  const phase = useRelay((s) => s.liveLap?.phase);
  const primaryRef = useRef<HTMLButtonElement>(null);

  /* the baton pass takes over the screen — hand it the stage */
  useEffect(() => {
    if (resultOpen && (baton != null || phase === "REARM")) dismiss();
  }, [resultOpen, baton, phase, dismiss]);

  /* Esc dismisses */
  useEffect(() => {
    if (!resultOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resultOpen, dismiss]);

  /* focus the primary action (trap-lite) */
  useEffect(() => {
    if (!resultOpen) return;
    const t = setTimeout(() => primaryRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [resultOpen, lastResult]);

  return (
    <AnimatePresence>
      {resultOpen && lastResult && (
        <motion.div
          key={lastResult.lap}
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-outcome-title"
          className="fixed inset-0 z-[80] grain grain-d overflow-y-auto scroll-thin"
          style={{ background: "rgba(20,17,10,0.97)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="min-h-full grid place-items-center px-4 py-6 sm:py-8">
            <motion.div
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="w-full max-w-lg flex flex-col items-center text-center"
            >
              <ResultBody
                r={lastResult}
                onKeepWatching={dismiss}
                onOpenTape={() => {
                  dismiss();
                  goScreen("history");
                }}
                primaryRef={primaryRef}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── the result body ────────────────────────────────────────── */

function ResultBody({
  r,
  onKeepWatching,
  onOpenTape,
  primaryRef,
}: {
  r: LapResult;
  onKeepWatching: () => void;
  onOpenTape: () => void;
  primaryRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const isWin = r.outcome === "WIN";
  const isVoid = r.outcome === "VOID";
  const isLoss = r.outcome === "LOSS";
  const outcomeColor = isWin ? "#aae83c" : isVoid ? "#b3a98f" : "#f0512a";

  const marketOutcome = isVoid
    ? null
    : r.closePrice > r.openPrice
      ? "UP"
      : r.closePrice < r.openPrice
        ? "DOWN"
        : "VOID";

  return (
    <>
      {/* kicker */}
      <div className="mlabel text-flame">LAP {r.lap} · SETTLED ON-CHAIN</div>

      {/* the outcome */}
      <div className="mt-4 flex items-center gap-4 sm:gap-6">
        {!isVoid && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 16 }}
          >
            {isWin ? <UpMark className="w-14 h-14 sm:w-20 sm:h-20" /> : <DownMark className="w-14 h-14 sm:w-20 sm:h-20" />}
          </motion.div>
        )}
        <h1
          id="result-outcome-title"
          className="font-black wider leading-[0.9] tracking-[-0.01em] text-7xl sm:text-8xl"
          style={{ color: outcomeColor, fontFamily: "var(--font-display)" }}
        >
          {isWin ? "WIN" : isVoid ? "VOID" : "LOSS"}
        </h1>
      </div>

      {isVoid ? (
        <>
          <div className="data text-4xl font-semibold text-foam mt-5" aria-live="polite">
            {money(r.stake)}
          </div>
          <div className="mlabel text-foam/80 mt-2.5">STAKE RETURNED — A REFUND IS NOT A LOSS</div>
        </>
      ) : (
        <CountUp
          from={0}
          to={r.pnl}
          delay={0.3}
          duration={1}
          format={(v) => signed(v)}
          className="data text-5xl font-semibold mt-4 tabular-nums"
          aria-label={`Lap result ${signed(r.pnl)}`}
        />
      )}

      {isLoss && (
        <p className="mt-3 text-foam text-sm max-w-sm leading-relaxed">
          Streaks end. The floor held: worst case was capped at your stop-loss.
        </p>
      )}

      {/* market line */}
      <div className="mt-5 flex items-center gap-2.5 flex-wrap justify-center">
        <AssetIcon asset={r.asset} size={18} />
        <span className="data text-sm text-foam">
          {r.asset} closed {fmtPrice(r.closePrice, r.asset)} vs open {fmtPrice(r.openPrice, r.asset)} →
        </span>
        <span
          className={cn(
            "mlabel px-2 py-0.5 rounded-md border",
            marketOutcome === "UP"
              ? "border-lime/60 text-lime"
              : marketOutcome === "DOWN"
                ? "border-ember/60 text-ember"
                : "border-foam/40 text-foam"
          )}
        >
          {marketOutcome ?? "0.5 / 0.5 · DEAD HEAT"}
        </span>
        <span className="mlabel text-foam/80 flex items-center gap-1.5 border border-lined px-2 py-0.5 rounded-md">
          YOU WERE
          {r.side === "UP" ? (
            <UpMark className="w-3.5 h-3.5" />
          ) : (
            <DownMark className="w-3.5 h-3.5" />
          )}
          {r.side}
        </span>
      </div>

      {/* the streak moment */}
      <StreakMoment r={r} />

      {/* bankroll row */}
      <div className="mt-5 w-full max-w-md grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 sm:gap-3">
        <StatTile label="BANKROLL BEFORE" value={money(r.bankrollBefore)} />
        <ArrowRight className="w-5 h-5 text-foam shrink-0" aria-hidden />
        <StatTile
          label="BANKROLL AFTER"
          value={money(r.bankrollAfter)}
          tone={r.bankrollAfter > r.bankrollBefore ? "up" : "cream"}
        />
      </div>
      <div className="mt-2.5 mlabel text-foam/70">
        LAP PNL{" "}
        <span className={cn("data text-sm font-semibold", isWin ? "text-lime" : isVoid ? "text-foam" : "text-ember")}>
          {signed(r.pnl)}
        </span>
      </div>

      {/* proof receipt */}
      <div className="relative sticker-dark px-6 py-4 mt-6 w-full max-w-sm text-left">
        <VerifiedSeal size={56} label="VERIFIED" className="absolute -top-7 -right-3 rotate-6" />
        <h2 className="mlabel text-cream">VERIFIED · LAP {r.lap}</h2>
        <ul className="mt-2.5 space-y-1.5">
          <ProofRow label="FILL" hash={r.proof.fillTx} />
          <ProofRow label="SETTLEMENT" hash={r.proof.settlementTx} />
          <ProofRow label="CLAIM" hash={r.proof.claimTx} />
        </ul>
        <div className="mt-3 pt-2.5 border-t border-cream/15 mlabel text-foam/70 leading-relaxed">
          ORACLE QUESTION {shortHash(r.proof.oracleQuestionId)}
          <br />
          SOMNIA REACTIVITY · ANSWERDELIVERED
        </div>
      </div>

      {/* next lap */}
      {r.nextMarket && (
        <div className="mt-5 flex items-center gap-2.5">
          <LiveDot tone="lime" />
          <span className="mlabel text-foam">
            NEXT: {r.nextMarket.asset} UP OR DOWN — BATON PASSING…
          </span>
        </div>
      )}

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          ref={primaryRef}
          onClick={onKeepWatching}
          className="mlabel text-xs px-7 py-3.5 rounded-xl border-2 border-lime bg-lime text-graphite font-semibold hover:bg-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/60"
        >
          KEEP WATCHING
        </button>
        <button
          onClick={onOpenTape}
          className="mlabel text-xs px-7 py-3.5 rounded-xl border-2 border-lined text-cream hover:border-cream/60 hover:bg-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
        >
          OPEN THE TAPE
        </button>
      </div>
    </>
  );
}

/* ── the streak moment (emotional core) ─────────────────────── */

function StreakMoment({ r }: { r: LapResult }) {
  const isWin = r.outcome === "WIN";
  const isVoid = r.outcome === "VOID";
  const shielded = r.outcome === "LOSS" && r.shieldUsed;

  return (
    <div className="mt-5 rounded-2xl border-2 border-lined bg-panel/70 px-6 py-3.5 inline-flex flex-col items-center gap-2 min-w-[15rem]">
      <span className="sr-only">
        Streak {r.streakAfter}, was {r.streakBefore}.
      </span>

      {isWin && (
        <>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 14 }}
          >
            <FlameMark className="w-10 h-11" animated />
          </motion.div>
          <div className="flex items-baseline gap-2.5">
            <span className="mlabel text-foam">STREAK</span>
            <StreakFlip before={r.streakBefore} after={r.streakAfter} />
          </div>
          <span className="mlabel text-foam/60">STAKE COMPOUNDS WITH IT</span>
        </>
      )}

      {shielded && (
        <>
          <ShieldConsumed />
          <span className="data text-lg font-bold wide text-flame" style={{ fontFamily: "var(--font-display)" }}>
            SHIELD ABSORBED THE LOSS
          </span>
          <span className="data text-2xl font-semibold text-flame">STREAK SURVIVES ×{r.streakAfter}</span>
        </>
      )}

      {r.outcome === "LOSS" && !shielded && (
        <>
          <FlameMark className="w-10 h-11 opacity-35" />
          <span className="data text-2xl font-semibold text-foam">STREAK RESET — ×0</span>
          <span className="mlabel text-foam/70">BASE STAKE RESETS WITH IT</span>
        </>
      )}

      {isVoid && (
        <>
          <FlameMark className="w-10 h-11" />
          <span className="data text-2xl font-semibold text-foam">
            STREAK PRESERVED ×{r.streakAfter}
          </span>
          <span className="mlabel text-foam/60">A VOID NEVER TOUCHES IT</span>
        </>
      )}
    </div>
  );
}

/** Odometer flip from the streak before the lap to the streak after it. */
function StreakFlip({ before, after }: { before: number; after: number }) {
  const [showAfter, setShowAfter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowAfter(true), 750);
    return () => clearTimeout(t);
  }, []);
  const v = showAfter ? after : before;

  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={v}
          className="data text-3xl font-semibold text-flame leading-none"
          initial={{ y: 22, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -22, opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          ×{v}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The shield getting consumed: filled → pulse → outline. */
function ShieldConsumed() {
  const [consumed, setConsumed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setConsumed(true), 950);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      animate={consumed ? { scale: [1, 1.22, 0.92], rotate: [0, -4, 0] } : { scale: [1, 1.06, 1] }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <ShieldMark filled={!consumed} className="w-10 h-11" />
    </motion.div>
  );
}

/* ── proof rows ─────────────────────────────────────────────── */

function ProofRow({ label, hash }: { label: string; hash: string }) {
  const url = explorerTxUrl(hash);
  return (
    <li className="flex items-center gap-2.5">
      <Check className="w-3.5 h-3.5 text-lime shrink-0" aria-hidden />
      <span className="mlabel text-foam/80 w-20 shrink-0">{label}</span>
      <a
        href={url ?? "#"}
        target={url ? "_blank" : undefined}
        rel={url ? "noopener noreferrer" : undefined}
        onClick={url ? undefined : (e) => e.preventDefault()}
        className="data text-xs text-cream/90 underline decoration-cream/25 underline-offset-2 hover:decoration-cream transition-colors"
        aria-label={`${label} transaction, Shannon explorer`}
      >
        {shortHash(hash)}
      </a>
    </li>
  );
}
