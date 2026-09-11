"use client";

/**
 * RELAY — the broadcast header of the Live Lap screen.
 * Row 1: live badge, lap number, market identity, THE COUNTDOWN.
 * Row 2: the window track (signature bar).
 * Row 3: the phase stepper.
 */

import { useRelay } from "@/lib/relay/engine/store";
import { LiveDot, PhaseStepper } from "@/components/relay/core/primitives";
import { AssetIcon } from "@/components/relay/identity/identity";
import { cn } from "@/lib/utils";
import { countdown, hhmm } from "@/lib/relay/format";
import { useCloseCountdown } from "@/lib/relay/live/useCloseCountdown";
import { WindowTrack } from "./WindowTrack";

export function BroadcastHeader({ className }: { className?: string }) {
  const lap = useRelay((s) => s.liveLap);
  const now = useRelay((s) => s.now);
  const clock = useCloseCountdown(lap?.market.closesAt, lap?.phase);
  if (!lap) return null;

  const { phase, market, number } = lap;
  const windowTotalMs = Math.max(1, market.closesAt - market.opensAt);
  const windowElapsedMs = Math.max(0, Math.min(windowTotalMs, now - market.opensAt));
  const label = clock.closed ? "CLOSED" : clock.label;
  const caption = clock.closed
    ? phase === "ORACLE" && lap.oracleWait?.delayed
      ? "RESOLUTION DELAYED"
      : phase === "ORACLE"
        ? "WAITING FOR ORACLE"
        : phase === "REARM"
          ? "NEXT WINDOW"
          : "CLOSED"
    : lap.joinHint
      ? "LIVE WINDOW"
      : "TO SETTLEMENT";

  /* countdown voice: lime cruising · flame closing · ember pulse in the last 10s */
  const color = clock.closed
    ? "#e8d5a8"
    : phase === "CLOSING"
      ? "#ffb224"
      : clock.remainingMs <= 10_000
        ? "#f0512a"
        : "#aae83c";
  const pulse = !clock.closed && phase !== "CLOSING" && clock.remainingMs <= 10_000;

  return (
    <header className={cn("border-b-2 border-lined bg-panel/40 px-4 sm:px-6 py-4", className)}>
      {/* row 1 — identity + countdown */}
      <div className="flex items-center justify-between gap-x-4 gap-y-3 flex-wrap">
        <div className="flex items-center gap-x-3 sm:gap-x-4 gap-y-2 flex-wrap min-w-0">
          <LiveDot label="LIVE" tone="lime" />
          <h1
            className="data font-bold text-xl text-cream leading-none tracking-tight"
            aria-label={`Lap ${number}, live`}
          >
            LAP {number}
          </h1>
          <div className="hidden sm:flex items-center gap-2.5 border-l-2 border-lined pl-4">
            <AssetIcon asset={market.asset} size={22} />
            <span className="mlabel text-cream/90">{market.asset} UP OR DOWN</span>
            <span className="mlabel px-1.5 py-0.5 rounded-md border border-lined text-flame">
              {market.cadence.toUpperCase()}
            </span>
            {lap.joinHint && !clock.closed ? (
              <span className="mlabel text-foam/70">JOINED AT {hhmm(lap.joinHint.joinedAt)}</span>
            ) : null}
          </div>
        </div>

        <div className="text-right shrink-0 ml-auto">
          <div className="mlabel text-foam/70 mb-1 hidden sm:block">{caption}</div>
          <div
            className={cn("data font-semibold text-5xl sm:text-6xl leading-none", pulse && "animate-pulse")}
            style={{ color }}
            role="timer"
            aria-label={`Window ${label} remaining`}
          >
            {label}
          </div>
          {clock.closed && lap.nextWindow && phase === "REARM" && lap.nextWindow.kind !== "joinable" ? (
            <div className="mlabel text-foam/70 mt-1">STARTS IN {countdown(Math.max(0, lap.nextWindow.startsAt - now))}</div>
          ) : null}
        </div>
      </div>

      {/* row 2 — the window track */}
      <div className="mt-7 mb-2">
        <WindowTrack progress={windowTotalMs ? windowElapsedMs / windowTotalMs : 0} />
      </div>

      {/* row 3 — phase stepper */}
      <div className="mt-1">
        <PhaseStepper phase={phase} history={lap.phaseHistory} />
      </div>
    </header>
  );
}
