"use client";

/**
 * RELAY — OutcomeStrip.
 * The lap tape as vertical ticks: every settled lap is a mark on a
 * dashed track — win lime, loss ember, void foam (short), shielded
 * losses carry a flame outline. Hover any tick for its receipt line.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { LapOutcome } from "@/lib/relay/types";
import { signed } from "@/lib/relay/format";
import {
  CH,
  ChartEmpty,
  ChartPanel,
  ChartSummary,
  ChartTip,
  LegendSwatch,
  localX,
  nearestIndex,
  useChartWidth,
} from "./kit";

export interface OutcomeTick {
  lap: number;
  outcome: LapOutcome;
  shielded: boolean;
  pnl: number;
  streakAfter: number;
}

interface Props {
  ticks: OutcomeTick[];
  ariaSummary: string;
  className?: string;
}

const OUTCOME_LABEL: Record<LapOutcome, string> = {
  WIN: "WIN",
  LOSS: "LOSS",
  VOID: "VOID",
};

const OUTCOME_TONE: Record<LapOutcome, "lime" | "ember" | "foam"> = {
  WIN: "lime",
  LOSS: "ember",
  VOID: "foam",
};

export function OutcomeStrip({ ticks, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [idx, setIdx] = useState<number | null>(null);

  const H = 132;
  const padL = 10;
  const padR = 12;
  const baseline = H - 28;

  const geo = useMemo(() => {
    if (ticks.length === 0 || w <= padL + padR + 20) return null;
    const innerW = w - padL - padR;
    const step = innerW / ticks.length;
    const tickW = Math.max(3, Math.min(11, step * 0.58));
    const xs = ticks.map((_, i) => padL + step * (i + 0.5));
    return { step, tickW, xs };
  }, [ticks, w]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    setIdx(nearestIndex(localX(e), geo.xs));
  };

  const hovered = idx != null && geo ? ticks[idx] : null;

  return (
    <ChartPanel
      label="THE TAPE · EVERY LAP"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="WIN" />
          <LegendSwatch color={CH.ember} label="LOSS" />
          <LegendSwatch color={CH.foam} label="VOID" />
          <LegendSwatch color={CH.flame} label="SHIELDED" shape="ring" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative w-full px-3 pt-2" style={{ height: H }}>
        {!geo ? (
          <ChartEmpty height={H - 8} note="one tick per settled lap" />
        ) : (
          <>
            <svg
              width={Math.max(0, w - 24)}
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
              {/* hover halo */}
              {idx != null && (
                <rect
                  x={geo.xs[idx] - geo.step / 2}
                  y={baseline - 52}
                  width={geo.step}
                  height={64}
                  fill={CH.cream}
                  opacity="0.07"
                  rx="3"
                />
              )}

              {/* track-dash baseline */}
              <line
                x1={2}
                x2={Math.max(0, w - 24) - 12}
                y1={baseline}
                y2={baseline}
                stroke={CH.foam}
                strokeWidth="2"
                strokeDasharray="14 12"
                opacity="0.55"
              />
              {/* arrowhead — the tape runs on */}
              <path
                d={`M${Math.max(0, w - 24) - 12} ${baseline - 4.5} l6 4.5 l-6 4.5`}
                fill="none"
                stroke={CH.foam}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />

              {/* ticks */}
              {ticks.map((t, i) => {
                const h = t.outcome === "VOID" ? 15 : 36;
                const y = baseline - h - 2;
                if (t.shielded) {
                  return (
                    <motion.rect
                      key={t.lap}
                      x={geo.xs[i] - geo.tickW / 2}
                      y={y}
                      width={geo.tickW}
                      height={h}
                      rx="2"
                      fill="rgba(255,178,36,0.22)"
                      stroke={CH.flame}
                      strokeWidth="2"
                      initial={{ opacity: 0, scaleY: 0.4 }}
                      whileInView={{ opacity: 1, scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.5) }}
                      style={{ transformOrigin: `${geo.xs[i]}px ${baseline}px` }}
                    />
                  );
                }
                const fill =
                  t.outcome === "WIN" ? CH.lime : t.outcome === "LOSS" ? CH.ember : CH.foam;
                return (
                  <motion.rect
                    key={t.lap}
                    x={geo.xs[i] - geo.tickW / 2}
                    y={y}
                    width={geo.tickW}
                    height={h}
                    rx="2"
                    fill={fill}
                    stroke={CH.graphite}
                    strokeWidth="1.4"
                    initial={{ opacity: 0, scaleY: 0.4 }}
                    whileInView={{ opacity: 1, scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.5) }}
                    style={{ transformOrigin: `${geo.xs[i]}px ${baseline}px` }}
                  />
                );
              })}

              {/* lap-number axis every 5th */}
              {ticks.map((t, i) =>
                i % 5 === 0 || i === ticks.length - 1 ? (
                  <text
                    key={`x${t.lap}`}
                    x={geo.xs[i]}
                    y={baseline + 16}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill={CH.foam}
                    opacity="0.75"
                    fontFamily="var(--font-data)"
                  >
                    {t.lap}
                  </text>
                ) : null
              )}
              <text
                x={Math.max(0, w - 24) - 2}
                y={baseline + 16}
                textAnchor="end"
                fontSize="8.5"
                fill={CH.foam}
                opacity="0.6"
                fontFamily="var(--font-data)"
                letterSpacing="0.14em"
              >
                LAP №
              </text>

              {/* start marker */}
              <path d={`M2 ${baseline - 5} l0 10`} stroke={CH.foam} strokeWidth="2" opacity="0.55" />
            </svg>

            {hovered && (
              <ChartTip
                x={geo.xs[idx!] - 12}
                y={baseline - 38}
                viewW={Math.max(0, w - 24)}
                flip={false}
                title={`LAP ${hovered.lap}`}
                lines={[
                  { k: "OUTCOME", v: OUTCOME_LABEL[hovered.outcome], tone: OUTCOME_TONE[hovered.outcome] },
                  {
                    k: "PNL",
                    v: signed(hovered.pnl),
                    tone: hovered.pnl > 0 ? "lime" : hovered.pnl < 0 ? "ember" : "foam",
                  },
                  { k: "STREAK", v: `×${hovered.streakAfter}`, tone: "flame" },
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
