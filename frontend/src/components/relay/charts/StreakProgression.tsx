"use client";

/**
 * RELAY — StreakProgression.
 * Step-line of streakAfter per lap: lime steps, a flame dot riding the
 * best-streak peak, ember dots where the streak hit zero. The best
 * streak is annotated with a dashed flame rule.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { LapOutcome } from "@/lib/relay/types";
import {
  CH,
  ChartEmpty,
  ChartPanel,
  ChartSummary,
  ChartTip,
  LegendSwatch,
  localX,
  nearestIndex,
  niceTicks,
  useChartWidth,
} from "./kit";

export interface StreakStep {
  lap: number;
  streak: number;
  outcome: LapOutcome;
  shielded: boolean;
}

interface Props {
  steps: StreakStep[];
  best: number;
  ariaSummary: string;
  className?: string;
}

const OUTCOME_TONE: Record<LapOutcome, "lime" | "ember" | "foam"> = {
  WIN: "lime",
  LOSS: "ember",
  VOID: "foam",
};

export function StreakProgression({ steps, best, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [idx, setIdx] = useState<number | null>(null);

  const H = 178;
  const padL = 40;
  const padR = 16;
  const padT = 18;
  const padB = 24;

  const geo = useMemo(() => {
    if (steps.length === 0 || w <= padL + padR + 40) return null;
    const laps = steps.map((s) => s.lap);
    const minLap = Math.min(...laps);
    const maxLap = Math.max(...laps);
    const maxStreak = Math.max(1, ...steps.map((s) => s.streak), best);
    const innerW = w - padL - padR;
    const innerH = H - padT - padB;
    const xs = steps.map((s) => padL + ((s.lap - minLap) / (maxLap - minLap || 1)) * innerW);
    const ys = steps.map((s) => padT + innerH - (s.streak / maxStreak) * innerH);
    // step-after path
    let d = "";
    steps.forEach((_, i) => {
      if (i === 0) d += `M${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
      else {
        d += ` L${xs[i].toFixed(1)} ${ys[i - 1].toFixed(1)} L${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
      }
    });
    const bestY = padT + innerH - (best / maxStreak) * innerH;
    return { minLap, maxLap, xs, ys, d, bestY, maxStreak, ticks: niceTicks(0, maxStreak, 4) };
  }, [steps, best, w]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    setIdx(nearestIndex(localX(e), geo.xs));
  };

  const hovered = idx != null && geo ? steps[idx] : null;

  return (
    <ChartPanel
      label="STREAK PROGRESSION · STEPS"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="STREAK" shape="line" />
          <LegendSwatch color={CH.flame} label="PEAK" shape="dot" />
          <LegendSwatch color={CH.ember} label="BROKEN" shape="dot" />
          <LegendSwatch color={CH.foam} label="VOID" shape="dot" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {!geo ? (
          <ChartEmpty height={H} note="the flame starts with a win" />
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
              {/* y gridlines */}
              {geo.ticks.map((t) => {
                const yv =
                  padT + (H - padT - padB) * (1 - t / geo.maxStreak);
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
                    <text
                      x={padL - 8}
                      y={yv + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill={CH.foam}
                      opacity="0.85"
                      fontFamily="var(--font-data)"
                    >
                      ×{t}
                    </text>
                  </g>
                );
              })}

              {/* best streak rule */}
              {best > 0 && (
                <g>
                  <line
                    x1={padL}
                    x2={w - padR}
                    y1={geo.bestY}
                    y2={geo.bestY}
                    stroke={CH.flame}
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                    opacity="0.8"
                  />
                  <text
                    x={padL + 4}
                    y={geo.bestY - 5}
                    fontSize="8.5"
                    fill={CH.flame}
                    fontFamily="var(--font-data)"
                    letterSpacing="0.1em"
                  >
                    BEST ×{best}
                  </text>
                </g>
              )}

              {/* steps */}
              <motion.path
                d={geo.d}
                fill="none"
                stroke={CH.lime}
                strokeWidth="2.2"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
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

              {/* dots */}
              {steps.map((s, i) => {
                const isPeak = s.streak === best && best > 0;
                if (isPeak) {
                  return (
                    <g key={s.lap}>
                      <circle cx={geo.xs[i]} cy={geo.ys[i]} r="7" fill="none" stroke={CH.flame} strokeWidth="1.4" opacity="0.45" />
                      <circle cx={geo.xs[i]} cy={geo.ys[i]} r="4" fill={CH.flame} stroke={CH.graphite} strokeWidth="1.5" />
                    </g>
                  );
                }
                const fill =
                  s.outcome === "WIN" ? CH.lime : s.outcome === "LOSS" ? CH.ember : CH.foam;
                return (
                  <circle
                    key={s.lap}
                    cx={geo.xs[i]}
                    cy={geo.ys[i]}
                    r={s.outcome === "LOSS" ? 2.8 : 2.2}
                    fill={fill}
                    stroke={CH.graphite}
                    strokeWidth="1.2"
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
                title={`LAP ${hovered.lap}`}
                lines={[
                  { k: "OUTCOME", v: hovered.outcome, tone: OUTCOME_TONE[hovered.outcome] },
                  { k: "STREAK", v: `×${hovered.streak}`, tone: "flame" },
                  ...(hovered.shielded
                    ? [{ k: "SHIELD", v: "ABSORBED · KEPT", tone: "flame" as const }]
                    : []),
                ]}
              />
            )}
          </>
        )}
      </div>
    </ChartPanel>
  );
}
