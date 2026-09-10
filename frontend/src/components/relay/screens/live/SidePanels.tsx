"use client";

/**
 * RELAY — Live Lap right-column panels:
 * probability split, condensed position, runner status chips.
 */

import { selectLivePnl, useRelay } from "@/lib/relay/engine/store";
import { Panel } from "@/components/relay/core/primitives";
import { ProbSplit } from "@/components/relay/core/LapRing";
import { FlameMark, ShieldMark } from "@/components/relay/identity/identity";
import { cents, pct, signed } from "@/lib/relay/format";
import { isLiveMode } from "@/lib/relay/live/mode";
import { cn } from "@/lib/utils";

/* ── implied probability ────────────────────────────────────── */

export function ProbabilityPanel({ className }: { className?: string }) {
  const raw = useRelay((s) => s.liveLap?.probUp);
  const ready = Number.isFinite(raw) && (raw as number) > 0 && (raw as number) < 1;
  const probUp = ready ? (raw as number) : null;

  return (
    <Panel label="PROBABILITY · IMPLIED" className={className}>
      <div className="px-5 py-4">
        {probUp == null ? (
          <div className="data text-sm text-foam">NO LIVE BOOK MID</div>
        ) : (
          <>
            <ProbSplit probUp={probUp} />
            <div className="mt-3 flex items-center justify-between">
              <span className="data text-sm font-semibold text-lime">UP {pct(probUp)}</span>
              <span className="data text-sm font-semibold text-ember">DOWN {pct(1 - probUp)}</span>
            </div>
          </>
        )}
        <div className="mlabel text-foam/50 mt-2.5">
          {probUp == null ? "UNAVAILABLE — NOT A 50¢ PLACEHOLDER" : "IMPLIED FROM FILL PRICE · SETTLES 0 OR 1"}
        </div>
      </div>
    </Panel>
  );
}

/* ── condensed position (during hold) ───────────────────────── */

export function PositionMini({ className }: { className?: string }) {
  const lap = useRelay((s) => s.liveLap);
  const pnl = selectLivePnl(lap);

  if (!lap?.position) return null;
  const p = lap.position;
  const pnlTone = pnl > 0 ? "text-lime" : pnl < 0 ? "text-ember" : "text-cream";

  return (
    <Panel label="POSITION · CONDENSED" className={className}>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "data font-bold text-sm px-2.5 py-1 rounded-md border-2 border-graphite",
              p.side === "UP" ? "bg-lime text-graphite" : "bg-ember text-cream"
            )}
          >
            {p.side === "UP" ? "▲ UP" : "▼ DOWN"}
          </span>
          <span className={cn("data text-xl font-semibold", pnlTone)} aria-live="polite">
            {signed(pnl)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label={`ENTRY · ${p.side} TERMS`} value={cents(p.entryPrice)} />
          <MiniStat label={`MARK · ${p.side} TERMS`} value={cents(p.markPrice)} />
        </div>
          {Number.isFinite(lap.probUp) && lap.probUp > 0 ? (
            <ProbSplit probUp={lap.probUp} height={8} />
          ) : null}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-lined bg-panel2/60 px-3 py-2.5">
      <div className="mlabel text-foam/80 truncate">{label}</div>
      <div className="data font-semibold text-cream mt-1 leading-none">{value}</div>
    </div>
  );
}

/* ── runner status chips ────────────────────────────────────── */

export function RunnerStatusRow({ className }: { className?: string }) {
  const runner = useRelay((s) => s.runner);
  const config = useRelay((s) => s.config);
  const streak = useRelay((s) => s.streak);

  if (!runner) return null;

  const biasChip =
    config.bias === "UP"
      ? "border-lime/60 text-lime"
      : config.bias === "DOWN"
        ? "border-ember/60 text-ember"
        : "border-flame/60 text-flame";
  const biasLabel =
    config.bias === "FOLLOW" ? "FOLLOW BOOK" : `MOMENTUM ${config.bias}`;
  const missingShields = Math.max(0, streak.shieldsMax - streak.shields);

  return (
    <Panel label="RUNNER STATUS" className={className}>
      <div className="px-5 py-4 flex flex-wrap items-center gap-2">
        <span className="mlabel px-2.5 py-1.5 rounded-lg border-2 border-lined text-cream/90 max-w-full truncate">
          {runner.strategy}
        </span>
        <span className={cn("mlabel px-2.5 py-1.5 rounded-lg border-2", biasChip)}>
          {biasLabel}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-flame/40">
          <FlameMark className="w-3.5 h-4" animated={streak.current > 0} />
          <span className="data font-semibold text-sm text-flame">×{streak.current}</span>
        </span>
        {isLiveMode() || streak.shieldsMax === 0 ? (
          <span className="mlabel px-2.5 py-1.5 rounded-lg border-2 border-lined text-foam/80">
            SHIELDS NOT ON-CHAIN
          </span>
        ) : (
          <span
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-lined"
            aria-label={`${streak.shields} of ${streak.shieldsMax} streak shields charged`}
          >
            {Array.from({ length: Math.min(streak.shields, 6) }, (_, i) => (
              <ShieldMark key={i} className="w-3.5 h-4" filled />
            ))}
            {Array.from({ length: Math.min(missingShields, 6 - Math.min(streak.shields, 6)) }, (_, i) => (
              <ShieldMark key={`empty-${i}`} className="w-3.5 h-4 opacity-35" filled={false} />
            ))}
          </span>
        )}
      </div>
    </Panel>
  );
}
