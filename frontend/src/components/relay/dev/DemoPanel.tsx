"use client";

/**
 * RELAY — dev demo console (hidden from normal users).
 * Opens via #/demo, the Settings row, or the easter egg: press "d" three
 * times within 1.2s anywhere (ignored while typing in inputs). Makes
 * presentations reliable: speed, forced outcomes, engine freeze, skip,
 * quick nav, reset. Mobile: bottom sheet. Desktop: floating console.
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { useRelay } from "@/lib/relay/engine/store";
import { countdown, money } from "@/lib/relay/format";
import type { LapPhase } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { LiveDot } from "../core/primitives";

const SPEEDS = [1, 2, 4, 8] as const;
const OUTCOMES = [
  { key: "win", label: "WIN" },
  { key: "loss", label: "LOSS" },
  { key: "void", label: "VOID" },
] as const;

const OUTCOME_STYLES = {
  win: "border-lime/70 text-lime aria-pressed:bg-lime aria-pressed:text-graphite aria-pressed:border-lime",
  loss: "border-ember/70 text-ember aria-pressed:bg-ember aria-pressed:text-cream aria-pressed:border-ember",
  void: "border-lined text-foam aria-pressed:bg-panel2 aria-pressed:text-cream aria-pressed:border-foam/50",
} as const;

/* tiny section label between hairlines */
function DevLabel({ children }: { children: string }) {
  return (
    <div className="mt-3 border-t-2 border-lined pt-3">
      <span className="mlabel text-foam/70">{children}</span>
    </div>
  );
}

/* dev button base */
const DEV_BTN =
  "data min-h-[36px] flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime disabled:pointer-events-none disabled:opacity-35";

export function DemoPanel() {
  const panelOpen = useRelay((s) => s.demo.panelOpen);
  const speed = useRelay((s) => s.demo.speed);
  const forced = useRelay((s) => s.demo.forcedOutcome);
  const paused = useRelay((s) => s.demo.paused);
  const liveLap = useRelay((s) => s.liveLap);
  const bankroll = useRelay((s) => s.bankroll);
  const streak = useRelay((s) => s.streak.current);
  const lastResult = useRelay((s) => s.lastResult);
  const togglePanel = useRelay((s) => s.demoTogglePanel);
  const setSpeed = useRelay((s) => s.demoSetSpeed);
  const force = useRelay((s) => s.demoForce);
  const togglePause = useRelay((s) => s.demoTogglePause);
  const skip = useRelay((s) => s.demoSkip);
  const goScreen = useRelay((s) => s.goScreen);
  const openResult = useRelay((s) => s.openResult);
  const resetDemo = useRelay((s) => s.resetDemo);

  /* ── easter egg: "d" ×3 within 1.2s opens the console ── */
  const taps = useRef<number[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== "d") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      const now = performance.now();
      taps.current = taps.current.filter((ts) => now - ts < 1200);
      taps.current.push(now);
      if (taps.current.length >= 3) {
        taps.current = [];
        useRelay.getState().demoTogglePanel(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const phase: LapPhase | null = liveLap?.phase ?? null;
  const canSkip = phase === "HOLD" || phase === "CLOSING";

  const onReset = () => {
    if (window.confirm("Reset the demo? This restores the 17-lap story and redeploys the original runner.")) {
      resetDemo();
    }
  };

  return (
    <AnimatePresence>
      {panelOpen && (
        <motion.div
          key="demo-panel"
          role="dialog"
          aria-label="Demo controls"
          aria-modal={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") togglePanel(false);
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="grain grain-d hardshadow-d fixed inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-y-auto scroll-thin overscroll-contain rounded-t-2xl border-2 border-lined bg-panel text-cream sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[calc(100vh-2rem)] sm:w-72 sm:rounded-2xl"
        >
          <div className="px-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:pb-3.5">
            {/* ── header ── */}
            <div className="flex items-center gap-2">
              <span className="mlabel text-lime">DEMO CONSOLE</span>
              {paused && (
                <span className="mlabel blink rounded-md border border-ember/60 px-1.5 py-0.5 text-ember">
                  FROZEN
                </span>
              )}
              <button
                type="button"
                onClick={() => togglePanel(false)}
                aria-label="Close demo controls"
                className="ml-auto grid size-8 place-items-center rounded-lg text-foam transition-colors hover:bg-panel2 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {/* ── state readout ── */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="mlabel text-foam/70">STATE</span>
                <LiveDot tone={paused ? "ember" : "lime"} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Readout label="LAP" value={liveLap ? String(liveLap.number) : "—"} />
                <Readout label="PHASE" value={phase ?? "—"} />
                <Readout label="COUNTDOWN" value={liveLap ? countdown(liveLap.countdownMs) : "—:—"} />
                <Readout label="BANKROLL" value={money(bankroll)} />
                <Readout label="STREAK" value={`×${streak}`} />
                <Readout label="SPEED" value={`${speed}×`} />
              </div>
            </div>

            {/* ── speed ── */}
            <DevLabel>SPEED</DevLabel>
            <div className="mt-2 flex gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  aria-label={`Simulation speed ${s} times`}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    DEV_BTN,
                    speed === s
                      ? "border-lime bg-lime text-graphite"
                      : "border-lined text-foam hover:text-cream"
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* ── force outcome ── */}
            <DevLabel>FORCE OUTCOME</DevLabel>
            <div className="mt-2 flex gap-1.5">
              {OUTCOMES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={forced === key}
                  onClick={() => force(forced === key ? null : key)}
                  className={cn(DEV_BTN, "aria-pressed:ring-2 aria-pressed:ring-cream/25", OUTCOME_STYLES[key])}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={forced == null}
                onClick={() => force(null)}
                className={cn(
                  DEV_BTN,
                  "border-lined text-foam/80",
                  forced == null && "border-foam/50 text-cream ring-2 ring-cream/20"
                )}
              >
                NONE
              </button>
            </div>
            <div className="data mt-1.5 text-[10px] text-foam/60">
              applies at the next window close
            </div>

            {/* ── engine ── */}
            <DevLabel>ENGINE</DevLabel>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => togglePause()}
                className={cn(
                  DEV_BTN,
                  paused
                    ? "border-lime/70 text-lime hover:bg-lime/10"
                    : "border-flame/70 text-flame hover:bg-flame/10"
                )}
              >
                {paused ? "RESUME" : "PAUSE"}
              </button>
              <button
                type="button"
                onClick={() => skip()}
                disabled={!canSkip}
                title={canSkip ? "Jump to the closing stretch" : "Only during HOLD or CLOSING"}
                className={cn(DEV_BTN, "border-lined text-foam hover:text-cream")}
              >
                SKIP TO CLOSING
              </button>
            </div>

            {/* ── navigate ── */}
            <DevLabel>NAVIGATE</DevLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  { label: "LIVE", fn: () => goScreen("live"), disabled: false },
                  { label: "HOME", fn: () => goScreen("home"), disabled: false },
                  { label: "ARENA", fn: () => goScreen("arena"), disabled: false },
                  { label: "TAPE", fn: () => goScreen("history"), disabled: false },
                  {
                    label: "RESULT",
                    fn: () => openResult(),
                    disabled: lastResult == null,
                  },
                ] as const
              ).map(({ label, fn, disabled }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  disabled={disabled}
                  className={cn(
                    DEV_BTN,
                    "flex-none px-2.5 text-[10px]",
                    "border-lined text-foam hover:text-cream"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── reset ── */}
            <DevLabel>RESET</DevLabel>
            <button
              type="button"
              onClick={onReset}
              className={cn(DEV_BTN, "mt-2 w-full border-ember/70 text-ember hover:bg-ember/10")}
            >
              RESET DEMO
            </button>
            <div className="data mt-1.5 text-[10px] text-foam/60">
              restores the 17-lap story
            </div>

            {/* ── footer ── */}
            <div className="mlabel mt-3 border-t-2 border-lined pt-2.5 text-foam/50">
              DEMO DATA · SHANNON TESTNET · NOT FINANCIAL ADVICE
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mlabel text-foam/50">{label}</div>
      <div className="data truncate text-[11px] font-semibold text-cream">{value}</div>
    </div>
  );
}
