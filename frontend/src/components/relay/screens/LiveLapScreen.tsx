"use client";

/**
 * RELAY — the LIVE LAP screen.
 * Live sports broadcast meets premium trading terminal: broadcast header
 * with the signature window track, price chart with the resolution
 * narrative, the order lifecycle card, the book, the lap feed.
 */

import { motion } from "framer-motion";
import { Check, Loader2, Pause, Play, ShieldAlert } from "lucide-react";
import { useRelay } from "@/lib/relay/engine/store";
import { LiveDot } from "@/components/relay/core/primitives";
import { AssetIcon, BatonGlyph } from "@/components/relay/identity/identity";
import { countdown, hhmm } from "@/lib/relay/format";
import { BroadcastHeader } from "./live/BroadcastHeader";
import { PricePanel } from "./live/PricePanel";
import { OrderLifecycle } from "./live/OrderLifecycle";
import { EventFeed } from "./live/EventFeed";
import { BookPanel } from "./live/BookPanel";
import { PositionMini, ProbabilityPanel, RunnerStatusRow } from "./live/SidePanels";

export function LiveLapScreen() {
  const runner = useRelay((s) => s.runner);

  if (!runner) return <NoRunnerState />;
  if (runner.status === "DEPLOYING") return <ArmingState />;
  return <LiveTrack />;
}

/* ── the live broadcast ─────────────────────────────────────── */

function LiveTrack() {
  const runner = useRelay((s) => s.runner);
  const liveLap = useRelay((s) => s.liveLap);
  const resume = useRelay((s) => s.resumeRunner);
  const goScreen = useRelay((s) => s.goScreen);

  const paused = runner?.status === "PAUSED";
  const parked = runner?.status === "PARKED";

  return (
    <div className="min-h-full grain grain-d pb-24 lg:pb-6">
      <BroadcastHeader />

      {paused && (
        <div className="border-b-2 border-flame/30 bg-flame/10 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <Pause className="w-4 h-4 text-flame shrink-0" aria-hidden />
          <span className="mlabel text-flame">RUNNER PAUSED</span>
          <span className="text-xs text-foam">
            No new laps will start. The open position settles normally.
          </span>
          <button
            onClick={resume}
            className="ml-auto mlabel px-3 py-1.5 rounded-lg border-2 border-flame text-flame hover:bg-flame hover:text-graphite transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            <Play className="w-3 h-3" aria-hidden /> RESUME
          </button>
        </div>
      )}

      {parked && (
        <div className="border-b-2 border-ember/30 bg-ember/10 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <ShieldAlert className="w-4 h-4 text-ember shrink-0" aria-hidden />
          <span className="mlabel text-ember">PARKED AT THE FLOOR</span>
          <span className="text-xs text-foam">
            Stop-loss reached. Worst case was capped — nothing beyond the floor was ever at risk.
          </span>
          <button
            onClick={() => goScreen("deploy")}
            className="ml-auto mlabel px-3 py-1.5 rounded-lg border-2 border-ember text-ember hover:bg-ember hover:text-cream transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
          >
            REDEPLOY
          </button>
        </div>
      )}

      {!liveLap ? (
        <BetweenLaps />
      ) : (
        <div className="mx-auto max-w-[1440px] px-3 sm:px-5 lg:px-6 py-4 lg:py-5 grid gap-4 lg:grid-cols-[1fr_360px] items-start">
          {/* left column */}
          <PricePanel className="order-1 lg:col-start-1 lg:row-start-1" />
          <OrderLifecycle className="order-2 lg:col-start-1 lg:row-start-2" />
          <EventFeed className="order-4 lg:col-start-1 lg:row-start-3" />
          {/* right column — book rides above feed on mobile */}
          <BookPanel className="order-3 lg:col-start-2 lg:row-start-1" />
          <ProbabilityPanel className="order-5 lg:col-start-2 lg:row-start-2" />
          <PositionMini className="order-6 lg:col-start-2 lg:row-start-3" />
          <RunnerStatusRow className="order-7 lg:col-start-2 lg:row-start-4" />
        </div>
      )}
    </div>
  );
}

/* ── between laps ───────────────────────────────────────────── */

function BetweenLaps() {
  const runner = useRelay((s) => s.runner);
  const calendar = useRelay((s) => s.calendar);
  const now = useRelay((s) => s.now);
  const resume = useRelay((s) => s.resumeRunner);
  const goScreen = useRelay((s) => s.goScreen);

  const next = calendar[0] ?? null;
  const ms = next ? Math.max(0, next.opensAt - now) : 0;
  const status = runner?.status;
  const paused = status === "PAUSED";
  const parked = status === "PARKED";
  const stopped = status === "STOPPED";

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20 text-center grain grain-d pb-24">
      <LiveDot
        label={stopped ? "KILLED" : parked ? "PARKED" : paused ? "WAITING" : "BETWEEN LAPS"}
        tone={stopped ? "ember" : parked ? "ember" : paused ? "flame" : "lime"}
      />

      <h2 className="mt-4 text-2xl font-extrabold wide text-cream" style={{ fontFamily: "var(--font-display)" }}>
        {stopped ? "RUNNER KILLED" : parked ? "PARKED AT THE FLOOR" : "BETWEEN LAPS"}
      </h2>

      {stopped ? (
        <>
          <p className="mt-3 text-foam text-sm max-w-sm mx-auto">
            Orders self-expire. Your bankroll stays withdrawable — always. The operator key
            is the only thing that can ever move funds.
          </p>
          <button
            onClick={() => goScreen("deploy")}
            className="mt-6 mlabel text-xs px-6 py-3.5 rounded-xl border-2 border-lime bg-lime text-graphite font-semibold hover:bg-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/50"
          >
            DEPLOY A NEW RUNNER
          </button>
        </>
      ) : parked ? (
        <>
          <p className="mt-3 text-foam text-sm max-w-sm mx-auto">
            The streak compounding stopped at the stop-loss floor. The floor held — worst
            case was capped at exactly what you set.
          </p>
          <button
            onClick={() => goScreen("deploy")}
            className="mt-6 mlabel text-xs px-6 py-3.5 rounded-xl border-2 border-ember bg-ember text-cream font-semibold hover:bg-ember/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/50"
          >
            REDEPLOY RUNNER
          </button>
        </>
      ) : next ? (
        <>
          <div className="mt-6 rounded-2xl border-2 border-lined bg-panel px-6 py-6 inline-flex flex-col items-center gap-3">
            <div className="flex items-center gap-2.5">
              <AssetIcon asset={next.asset} size={26} />
              <span className="mlabel text-cream">{next.asset} UP OR DOWN</span>
              <span className="mlabel text-flame">{next.cadence.toUpperCase()}</span>
            </div>
            <div className="data text-4xl font-semibold text-cream" role="timer" aria-live="polite">
              {countdown(ms)}
            </div>
            <div className="mlabel text-foam/70">UNTIL WINDOW OPENS · {hhmm(next.opensAt)}</div>
          </div>
          {paused && (
            <button
              onClick={resume}
              className="mt-6 mlabel text-xs px-6 py-3.5 rounded-xl border-2 border-flame text-flame hover:bg-flame hover:text-graphite transition-colors flex items-center gap-2 mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/50"
            >
              <Play className="w-3.5 h-3.5" aria-hidden /> RESUME FOR THIS WINDOW
            </button>
          )}
        </>
      ) : (
        <p className="mt-4 text-foam text-sm">
          No windows scheduled right now. The runner re-arms the moment one opens.
        </p>
      )}
    </div>
  );
}

/* ── no runner on the track ─────────────────────────────────── */

function NoRunnerState() {
  const goScreen = useRelay((s) => s.goScreen);
  const ownerReady = useRelay((s) => s.ownerReady);
  const connected = useRelay((s) => s.wallet.connected);
  if (connected && !ownerReady) {
    return (
      <div className="grid place-items-center px-4 py-20 sm:py-28 min-h-[70vh] grain grain-d">
        <div className="text-center">
          <LiveDot label="SYNC" tone="flame" />
          <h2 className="mt-6 text-3xl font-extrabold wide text-cream" style={{ fontFamily: "var(--font-display)" }}>
            RECONSTRUCTING LAP
          </h2>
          <p className="mt-3 text-foam text-sm max-w-sm mx-auto">
            Fetching the runner, active market, and proof. Not an empty field.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center px-4 py-20 sm:py-28 min-h-[70vh] grain grain-d">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <BatonGlyph className="w-24 h-auto mx-auto opacity-30" />
        <h2
          className="mt-6 text-3xl font-extrabold wide text-cream"
          style={{ fontFamily: "var(--font-display)" }}
        >
          No runner on the track
        </h2>
        <p className="mt-3 text-foam text-sm max-w-sm mx-auto">
          Deploy one — it trades every window, settles, claims and re-arms itself.
          You just watch.
        </p>
        <button
          onClick={() => goScreen("deploy")}
          className="mt-7 mlabel text-xs px-7 py-4 rounded-xl border-2 border-lime bg-lime text-graphite font-semibold hover:bg-lime/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/50"
        >
          DEPLOY YOUR RUNNER
        </button>
      </motion.div>
    </div>
  );
}

/* ── deploying: the arming sequence ─────────────────────────── */

const ARMING_STEPS = [
  { label: "Vault provisioned", note: "SPEND LIMIT LOCKED", done: true },
  { label: "Funding confirmed", note: "tUSDC ESCROWED", done: true },
  { label: "Reactivity armed", note: "SETTLE + CLAIM + RE-ARM", done: true },
  { label: "Scanning windows…", note: "FIRST LAP INCOMING", done: false },
];

function ArmingState() {
  return (
    <div className="grid place-items-center px-4 py-16 sm:py-24 min-h-[70vh] grain grain-d">
      <div className="w-full max-w-sm">
        <LiveDot label="ARMING" tone="flame" />
        <h2
          className="mt-3 text-2xl font-extrabold wide text-cream"
          style={{ fontFamily: "var(--font-display)" }}
        >
          RUNNER DEPLOYING
        </h2>
        <ul className="mt-6 space-y-2.5">
          {ARMING_STEPS.map((step, i) => (
            <motion.li
              key={step.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.3, duration: 0.35, ease: "easeOut" }}
              className="flex items-center gap-3 rounded-xl border-2 border-lined bg-panel px-4 py-3"
            >
              {step.done ? (
                <Check className="w-4 h-4 text-lime shrink-0" aria-hidden />
              ) : (
                <Loader2 className="w-4 h-4 text-flame animate-spin shrink-0" aria-hidden />
              )}
              <span className="text-sm text-cream font-medium">{step.label}</span>
              <span className="ml-auto mlabel text-foam/60">{step.note}</span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-5 mlabel text-foam/60 text-center">
          THE RUNNER CANNOT WITHDRAW YOUR FUNDS
        </p>
      </div>
    </div>
  );
}
