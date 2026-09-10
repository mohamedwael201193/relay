"use client";

/**
 * RELAY — BankrollChart (analytics hero).
 * Area + line of the bankroll across the tape: x = lap number, y = $.
 * Lime line, win/loss dot markers, dashed START reference, live NOW
 * point, crosshair tooltip. Hand-built SVG.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { LapOutcome } from "@/lib/relay/types";
import { money, signed } from "@/lib/relay/format";
import {
  CH,
  ChartEmpty,
  ChartPanel,
  ChartSummary,
  ChartTip,
  LegendSwatch,
  localX,
  moneyTick,
  nearestIndex,
  niceTicks,
  useChartWidth,
  useSvgId,
} from "./kit";

export interface BankrollPoint {
  lap: number;
  bankroll: number;
  pnl?: number;
  outcome?: LapOutcome | null;
  shielded?: boolean;
  live?: boolean;
}

interface Props {
  /** Settled points — index 0 must be the DEPLOY point (lap 0, start bankroll). */
  points: BankrollPoint[];
  /** Appended as the live "NOW" point when a lap is in flight. */
  nowPoint?: { lap: number; bankroll: number } | null;
  ariaSummary: string;
  className?: string;
}

const OUTCOME_TONE: Record<string, "lime" | "ember" | "foam"> = {
  WIN: "lime",
  LOSS: "ember",
  VOID: "foam",
};

function dotFill(p: BankrollPoint): string {
  if (p.live) return CH.cream;
  if (p.outcome === "WIN") return CH.lime;
  if (p.outcome === "LOSS") return CH.ember;
  return CH.foam;
}

export function BankrollChart({ points, nowPoint, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [idx, setIdx] = useState<number | null>(null);
  const gid = useSvgId("bk");

  const data = useMemo<BankrollPoint[]>(() => {
    const pts = points.filter((p) => !p.live);
    if (nowPoint && pts.length > 0) {
      pts.push({ ...nowPoint, live: true, outcome: null, pnl: 0 });
    }
    return pts;
  }, [points, nowPoint]);

  const H = w < 520 ? 172 : 224;
  const padL = 52;
  const padR = 30;
  const padT = 16;
  const padB = 24;

  const geo = useMemo(() => {
    // need at least START + one settled lap; the NOW point alone is not a tape
    const settled = data.filter((p) => !p.live).length;
    if (settled < 2 || w <= padL + padR + 40) return null;
    const laps = data.map((p) => p.lap);
    const minLap = Math.min(...laps);
    const maxLap = Math.max(...laps);
    const vals = data.map((p) => p.bankroll);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const span = hi - lo || Math.max(1, hi * 0.08);
    lo -= span * 0.14;
    hi += span * 0.14;
    const innerW = w - padL - padR;
    const innerH = H - padT - padB;
    const x = (lap: number) =>
      padL + (maxLap === minLap ? innerW : ((lap - minLap) / (maxLap - minLap)) * innerW);
    const y = (v: number) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;
    const xs = data.map((p) => x(p.lap));
    const ys = data.map((p) => y(p.bankroll));
    const settledCount = data.filter((p) => !p.live).length;
    const solid = data
      .slice(0, settledCount)
      .map((p, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
      .join(" ");
    const lastSettled = settledCount - 1;
    const liveDash =
      settledCount < data.length
        ? `M${xs[lastSettled].toFixed(1)} ${ys[lastSettled].toFixed(1)} L${xs[xs.length - 1].toFixed(1)} ${ys[ys.length - 1].toFixed(1)}`
        : "";
    const area = `${solid} L${xs[lastSettled].toFixed(1)} ${H - padB} L${xs[0].toFixed(1)} ${H - padB} Z`;
    return { minLap, maxLap, lo, hi, xs, ys, solid, liveDash, area, lastSettled, ticks: niceTicks(lo, hi, 4) };
  }, [data, w, H]);

  const start = data[0]?.bankroll ?? 0;
  const startRefY = geo ? geo.ys[0] : 0;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    setIdx(nearestIndex(localX(e), geo.xs));
  };

  const hovered = idx != null && geo ? data[idx] : null;

  return (
    <ChartPanel
      label="BANKROLL · LAP BY LAP"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="WIN" shape="dot" />
          <LegendSwatch color={CH.ember} label="LOSS" shape="dot" />
          <LegendSwatch color={CH.foam} label="VOID" shape="dot" />
          <LegendSwatch color={CH.cream} label="NOW" shape="dot" />
          <LegendSwatch color={CH.foam} label="START REF" shape="line" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {!geo ? (
          <ChartEmpty height={H} note="bankroll curve lights up after the first settle" />
        ) : (
          <>
            <svg
              width={w}
              height={H}
              className="block"
              role="img"
              aria-label={ariaSummary}
              style={{ touchAction: "pan-y" }}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setIdx(null)}
              onPointerCancel={() => setIdx(null)}
            >
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={CH.lime} stopOpacity="0.20" />
                  <stop offset="1" stopColor={CH.lime} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* y gridlines + labels (skip the tick that collides with the START ref) */}
              {geo.ticks.map((t) => {
                const yv = geo.ys.length ? padT + (H - padT - padB) * (1 - (t - geo.lo) / (geo.hi - geo.lo)) : 0;
                const nearStart = Math.abs(yv - startRefY) < 11;
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={w - padR}
                      y1={yv}
                      y2={yv}
                      stroke={CH.lined}
                      strokeWidth="1"
                      opacity="0.8"
                    />
                    {!nearStart && (
                      <text
                        x={padL - 8}
                        y={yv + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill={CH.foam}
                        opacity="0.85"
                        fontFamily="var(--font-data)"
                      >
                        {moneyTick(t)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* START reference line */}
              <line
                x1={padL}
                x2={w - padR}
                y1={startRefY}
                y2={startRefY}
                stroke={CH.foam}
                strokeWidth="1.3"
                strokeDasharray="6 5"
                opacity="0.75"
              />
              <text
                x={padL + 4}
                y={startRefY - 5}
                fontSize="8.5"
                fill={CH.foam}
                fontFamily="var(--font-data)"
                letterSpacing="0.08em"
              >
                START {money(start)}
              </text>

              {/* area */}
              <motion.path
                d={geo.area}
                fill={`url(#${gid})`}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.25 }}
              />

              {/* the live segment to NOW */}
              {geo.liveDash && (
                <path
                  d={geo.liveDash}
                  fill="none"
                  stroke={CH.cream}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.7"
                  strokeLinecap="round"
                />
              )}

              {/* line */}
              <motion.path
                d={geo.solid}
                fill="none"
                stroke={CH.lime}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />

              {/* x ticks + tick marks */}
              {(() => {
                const step = Math.max(1, Math.ceil((geo.maxLap - geo.minLap) / 6));
                const out: React.ReactNode[] = [];
                for (let lap = geo.minLap; lap <= geo.maxLap; lap += step) {
                  const xv =
                    padL + ((lap - geo.minLap) / Math.max(1, geo.maxLap - geo.minLap)) * (w - padL - padR);
                  out.push(
                    <g key={lap}>
                      <line x1={xv} x2={xv} y1={H - padB} y2={H - padB + 4} stroke={CH.foam} strokeWidth="1.4" opacity="0.6" />
                      <text
                        x={xv}
                        y={H - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fill={CH.foam}
                        opacity="0.8"
                        fontFamily="var(--font-data)"
                      >
                        {lap}
                      </text>
                    </g>
                  );
                }
                return out;
              })()}
              <text
                x={w - padR}
                y={H - 8}
                textAnchor="end"
                fontSize="8.5"
                fill={CH.foam}
                opacity="0.6"
                fontFamily="var(--font-data)"
                letterSpacing="0.14em"
              >
                LAP №
              </text>

              {/* dot markers */}
              {data.map((p, i) => {
                if (p.live) {
                  return (
                    <g key="now-dot">
                      <circle cx={geo.xs[i]} cy={geo.ys[i]} r="6.5" fill="none" stroke={CH.cream} strokeWidth="1.6" className="blink" opacity="0.8" />
                      <circle cx={geo.xs[i]} cy={geo.ys[i]} r="4" fill={CH.cream} stroke={CH.graphite} strokeWidth="1.6" />
                      <text
                        x={geo.xs[i]}
                        y={geo.ys[i] - 12}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill={CH.cream}
                        fontFamily="var(--font-data)"
                        letterSpacing="0.14em"
                      >
                        NOW
                      </text>
                    </g>
                  );
                }
                if (i === 0) {
                  return (
                    <circle key={`d${i}`} cx={geo.xs[i]} cy={geo.ys[i]} r="2.6" fill={CH.foam} stroke={CH.graphite} strokeWidth="1.2" />
                  );
                }
                return (
                  <circle
                    key={`d${i}`}
                    cx={geo.xs[i]}
                    cy={geo.ys[i]}
                    r={p.outcome === "WIN" || p.outcome === "LOSS" ? 3 : 2.6}
                    fill={dotFill(p)}
                    stroke={CH.graphite}
                    strokeWidth="1.4"
                  />
                );
              })}

              {/* crosshair */}
              {idx != null && (
                <g>
                  <line
                    x1={geo.xs[idx]}
                    x2={geo.xs[idx]}
                    y1={padT - 6}
                    y2={H - padB}
                    stroke={CH.cream}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.4"
                  />
                  <circle
                    cx={geo.xs[idx]}
                    cy={geo.ys[idx]}
                    r="5.5"
                    fill="none"
                    stroke={CH.cream}
                    strokeWidth="1.6"
                    opacity="0.9"
                  />
                </g>
              )}
            </svg>

            {hovered && (
              <ChartTip
                x={geo.xs[idx!]}
                y={geo.ys[idx!]}
                viewW={w}
                flip={geo.ys[idx!] < H * 0.45}
                title={
                  hovered.live
                    ? `LAP ${hovered.lap} · IN FLIGHT`
                    : hovered.lap === 0
                      ? "DEPLOY"
                      : `LAP ${hovered.lap}`
                }
                lines={
                  hovered.live
                    ? [
                        { k: "STATUS", v: "RUNNING NOW", tone: "flame" },
                        { k: "BANKROLL", v: money(hovered.bankroll) },
                      ]
                    : hovered.lap === 0
                      ? [
                          { k: "VAULT", v: "FUNDED", tone: "lime" },
                          { k: "BANKROLL", v: money(hovered.bankroll) },
                        ]
                      : [
                          {
                            k: "OUTCOME",
                            v: hovered.outcome,
                            tone: OUTCOME_TONE[hovered.outcome ?? ""] ?? "cream",
                          },
                          {
                            k: "PNL",
                            v: signed(hovered.pnl ?? 0),
                            tone: (hovered.pnl ?? 0) > 0 ? "lime" : (hovered.pnl ?? 0) < 0 ? "ember" : "foam",
                          },
                          { k: "BANKROLL", v: money(hovered.bankroll) },
                          ...(hovered.shielded
                            ? [{ k: "SHIELD", v: "ABSORBED", tone: "flame" as const }]
                            : []),
                        ]
                }
              />
            )}
          </>
        )}
      </div>
    </ChartPanel>
  );
}
