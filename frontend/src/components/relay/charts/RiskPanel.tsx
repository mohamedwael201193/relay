"use client";

/**
 * RELAY — RiskPanel.
 * Four stat tiles of hard risk math derived from the tape: max
 * drawdown (and as a share of peak), a sharpe-like ratio, the live
 * streak exposure (next stake), and the current drawdown.
 */

import { money, pct } from "@/lib/relay/format";
import { StatTile } from "../core/primitives";
import { ChartEmpty, ChartPanel, ChartSummary } from "./kit";

interface Props {
  laps: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  peak: number;
  drawdownNow: number;
  sharpe: number;
  nextStake: number;
  nextLap: number | null;
  streak: number;
  ariaSummary: string;
  className?: string;
}

export function RiskPanel({
  laps,
  maxDrawdown,
  maxDrawdownPct,
  peak,
  drawdownNow,
  sharpe,
  nextStake,
  nextLap,
  streak,
  ariaSummary,
  className,
}: Props) {
  return (
    <ChartPanel label="RISK · DRAWDOWN & EXPOSURE" className={className}>
      <ChartSummary text={ariaSummary} />
      {laps === 0 ? (
        <ChartEmpty height={140} note="risk needs decided laps to measure" />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-2">
          <StatTile
            label="MAX DRAWDOWN"
            value={money(-maxDrawdown)}
            tone={maxDrawdown > 0.005 ? "down" : "neutral"}
            sub={`${pct(maxDrawdownPct)} OF ${money(peak)} PEAK`}
          />
          <StatTile
            label="SHARPE-LIKE"
            value={sharpe.toFixed(2)}
            tone={sharpe > 0 ? "up" : "down"}
            sub="MEAN ÷ σ OF LAP PNL"
          />
          <StatTile
            label="STREAK RISK"
            value={money(nextStake)}
            tone="flame"
            sub={
              nextLap != null
                ? `STAKE AT LAP ${nextLap} · STREAK ×${streak}`
                : `STREAK ×${streak}`
            }
          />
          <StatTile
            label="DRAWDOWN NOW"
            value={money(-drawdownNow)}
            tone={drawdownNow > 0.005 ? "down" : "neutral"}
            sub={`PEAK ${money(peak)}`}
          />
        </div>
      )}
    </ChartPanel>
  );
}
