"use client";

/**
 * RELAY — ANALYTICS.
 * How the runner actually runs: attribution, calibration and risk over
 * the same verified tape. Every chart is a hand-built SVG in
 * charts/** — no chart libraries — and every number is derived from
 * the store.
 */

import { useMemo } from "react";
import { MotionConfig } from "framer-motion";
import { selectNextStake, useRelay } from "@/lib/relay/engine/store";
import { money } from "@/lib/relay/format";
import { expectedFairPerLap, summarizeTape } from "@/lib/relay/analytics";
import { FlameMark } from "../identity/identity";
import {
  BankrollChart,
  ExpectedVsRealized,
  OutcomeStrip,
  PnlByAsset,
  PnlByHour,
  RiskPanel,
  StreakProgression,
  WinRateDonut,
} from "../charts";
import type { AssetLane } from "../charts";
import type { BankrollPoint } from "../charts";

export function AnalyticsScreen() {
  const laps = useRelay((s) => s.laps);
  const bankroll = useRelay((s) => s.bankroll);
  const startBankroll = useRelay((s) => s.startBankroll);
  const streak = useRelay((s) => s.streak);
  const config = useRelay((s) => s.config);
  const liveLap = useRelay((s) => s.liveLap);

  /* ── derivations from the tape ── */

  const asc = useMemo(() => [...laps].sort((a, b) => a.number - b.number), [laps]);

  const counts = useMemo(() => summarizeTape(asc), [asc]);

  const bankrollPoints = useMemo<BankrollPoint[]>(() => {
    const pts: BankrollPoint[] = [
      { lap: 0, bankroll: startBankroll, pnl: 0, outcome: null },
    ];
    let b = startBankroll;
    for (const l of asc) {
      if (l.outcome !== "OPEN" && Number.isFinite(l.pnl)) b = b + l.pnl;
      pts.push({
        lap: l.number,
        bankroll: l.outcome === "OPEN" ? bankroll : b,
        pnl: l.pnl,
        outcome: l.outcome,
        shielded: l.shielded,
      });
    }
    return pts;
  }, [asc, startBankroll, bankroll]);

  const nowPoint = liveLap ? { lap: liveLap.number, bankroll } : null;

  const assetLanes = useMemo<AssetLane[]>(() => {
    return (["BTC", "ETH"] as const)
      .map((asset) => {
        const ls = asc.filter((l) => l.market.asset === asset);
        const wins = ls.filter((l) => l.outcome === "WIN").length;
        const losses = ls.filter((l) => l.outcome === "LOSS").length;
        const pnl = ls.filter((l) => Number.isFinite(l.pnl)).reduce((s, l) => s + l.pnl, 0);
        const decided = wins + losses;
        return {
          asset,
          pnl,
          laps: ls.length,
          wins,
          losses,
          winRate: decided > 0 ? wins / decided : Number.NaN,
        };
      })
      .filter((lane) => lane.laps > 0);
  }, [asc]);

  const streakSteps = useMemo(
    () =>
      asc.map((l) => ({
        lap: l.number,
        streak: l.streakAfter,
        outcome: l.outcome,
        shielded: l.shielded,
      })),
    [asc]
  );

  const risk = useMemo(() => {
    let peak = startBankroll;
    let maxDD = 0;
    for (const p of bankrollPoints) {
      peak = Math.max(peak, p.bankroll);
      maxDD = Math.max(maxDD, peak - p.bankroll);
    }
    const closedPnls = asc.filter((l) => l.outcome !== "OPEN" && Number.isFinite(l.pnl)).map((l) => l.pnl);
    const mean = closedPnls.length ? closedPnls.reduce((s, p) => s + p, 0) / closedPnls.length : 0;
    const variance =
      closedPnls.length > 1
        ? closedPnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (closedPnls.length - 1)
        : 0;
    const sd = Math.sqrt(variance);
    return {
      peak,
      maxDrawdown: maxDD,
      maxDrawdownPct: peak > 0 ? maxDD / peak : 0,
      drawdownNow: Math.max(0, peak - bankroll),
      sharpe: sd > 0 ? mean / sd : 0,
      nextStake: selectNextStake(bankroll, streak.current, config),
    };
  }, [asc, bankrollPoints, startBankroll, bankroll, streak.current, config]);

  const calib = useMemo(() => {
    return {
      expected: expectedFairPerLap(asc),
      realized: counts.averageRealizedReturn,
    };
  }, [asc, counts]);

  const hourBuckets = useMemo(() => {
    if (asc.length === 0) return [];
    const start = asc[0]?.settledAt ?? 0;
    const buckets = [0, 1, 2, 3, 4, 5].map((b) => {
      const inb = asc.filter((l) => Math.floor((l.settledAt - start) / (4 * 3_600_000)) === b);
      const wins = inb.filter((l) => l.outcome === "WIN").length;
      const losses = inb.filter((l) => l.outcome === "LOSS").length;
      const decidedN = wins + losses;
      return {
        bucket: b,
        label: `${String(9 + b).padStart(2, "0")}:00`,
        laps: inb.length,
        wins,
        pnl: +inb.filter((l) => Number.isFinite(l.pnl)).reduce((s, l) => s + l.pnl, 0).toFixed(2),
        winRate: decidedN > 0 ? wins / decidedN : Number.NaN,
      };
    });
    return buckets.filter((b) => b.laps > 0);
  }, [asc]);
  const bestStreak = streakSteps.reduce((m, s) => Math.max(m, s.streak), 0);
  const lastLap = asc[asc.length - 1]?.number ?? 0;
  const netTape = counts.netPnl;
  const decided = counts.decided;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* ── header ── */}
        <header>
          <div className="flex items-center gap-2">
            <FlameMark className="h-4 w-4" aria-hidden />
            <span className="mlabel text-flame">ANALYTICS</span>
          </div>
          <h1 className="mt-2 text-3xl font-black wide leading-[0.95] tracking-[-0.01em] sm:text-4xl">
            How the runner actually runs.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foam">
            Attribution, calibration and risk — derived from the same verified
            tape. No vanity metrics.
          </p>
        </header>

        {/* ── the grid ── */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <BankrollChart
            className="sm:col-span-2"
            points={bankrollPoints}
            nowPoint={nowPoint}
            ariaSummary={`Bankroll went from ${money(startBankroll)} to ${money(
              bankroll
            )} over ${asc.length} laps — ${counts.wins} wins, ${counts.losses} losses, ${
              counts.voids
            } void, ${counts.open} open.`}
          />

          <OutcomeStrip
            ticks={asc.map((l) => ({
              lap: l.number,
              outcome: l.outcome,
              shielded: l.shielded,
              pnl: l.pnl,
              streakAfter: l.streakAfter,
            }))}
            ariaSummary={`Lap tape: ${counts.wins} wins, ${counts.losses} losses, ${
              counts.voids
            } void and ${counts.open} open across ${asc.length} laps, best streak ×${bestStreak}.`}
          />

          <WinRateDonut
            wins={counts.wins}
            losses={counts.losses}
            voids={counts.voids}
            ariaSummary={
              decided > 0
                ? `Win rate ${Math.round((counts.wins / decided) * 1000) / 10}% (n=${counts.sampleN}) — ${counts.wins} wins, ${counts.losses} losses, ${counts.voids} void, ${counts.open} open.`
                : "Win rate — (n=0 decided laps)."
            }
          />

          <PnlByAsset
            lanes={assetLanes}
            ariaSummary={assetLanes
              .map((l) => `${l.asset} net ${l.pnl >= 0 ? "+" : "−"}$${Math.abs(l.pnl).toFixed(2)} over ${l.laps} laps`)
              .join("; ")}
          />

          <PnlByHour
            buckets={hourBuckets}
            ariaSummary={
              hourBuckets.length
                ? `Net PnL by 4-hour bucket, from ${money(
                    hourBuckets.reduce((m, b) => Math.min(m, b.pnl), Infinity)
                  )} to ${money(hourBuckets.reduce((m, b) => Math.max(m, b.pnl), -Infinity))}.`
                : "No session data yet."
            }
          />

          <StreakProgression
            steps={streakSteps}
            best={bestStreak}
            ariaSummary={`Streak after each of ${asc.length} laps, best streak ×${bestStreak}.`}
          />

          <ExpectedVsRealized
            expected={calib.expected ?? Number.NaN}
            realized={calib.realized ?? Number.NaN}
            laps={counts.sampleN}
            ariaSummary={
              calib.expected == null || calib.realized == null
                ? "Calibration — (n=0 decided laps)."
                : `Fair-coin expected ${money(calib.expected)} per lap versus realized ${money(
                    calib.realized
                  )} per lap (n=${counts.sampleN}).`
            }
          />

          <RiskPanel
            laps={decided}
            maxDrawdown={risk.maxDrawdown}
            maxDrawdownPct={risk.maxDrawdownPct}
            peak={risk.peak}
            drawdownNow={risk.drawdownNow}
            sharpe={risk.sharpe}
            nextStake={risk.nextStake}
            nextLap={liveLap ? liveLap.number : lastLap > 0 ? lastLap + 1 : null}
            streak={streak.current}
            ariaSummary={
              decided === 0
                ? "Risk — (n=0 decided laps)."
                : `Max drawdown ${money(-risk.maxDrawdown)}, ${
                    Math.round(risk.maxDrawdownPct * 1000) / 10
                  }% of the ${money(risk.peak)} peak. Tape net ${
                    netTape == null ? "—" : money(netTape, { sign: true })
                  }.`
            }
          />
        </div>
      </div>
    </MotionConfig>
  );
}
