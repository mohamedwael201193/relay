"use client";

/**
 * RELAY — WinRateDonut.
 * Donut of the decided-lap mix: wins lime, losses ember, voids foam.
 * Center carries the win rate (decided laps only) and the W·L·V tally.
 * Segments are hoverable with a mono readout card.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { pct } from "@/lib/relay/format";
import {
  CH,
  ChartEmpty,
  ChartPanel,
  ChartSummary,
  ChartTip,
  LegendSwatch,
  useChartWidth,
} from "./kit";

interface Props {
  wins: number;
  losses: number;
  voids: number;
  ariaSummary: string;
  className?: string;
}

const SIZE = 178;
const R = 62;
const SW = 17;
const GAP = 0.012; // fraction of the ring reserved as segment gap

export function WinRateDonut({ wins, losses, voids, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [seg, setSeg] = useState<number | null>(null);

  const total = wins + losses + voids;
  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : null;

  const segments = useMemo(() => {
    if (total === 0) return [];
    const raw = [
      { key: "WINS", n: wins, color: CH.lime },
      { key: "LOSSES", n: losses, color: CH.ember },
      { key: "VOIDS", n: voids, color: CH.foam },
    ].filter((s) => s.n > 0);
    let acc = 0;
    return raw.map((s) => {
      const frac = s.n / total;
      const start = acc;
      acc += frac;
      return { ...s, frac, start };
    });
  }, [wins, losses, voids, total]);

  const segMeta = [
    { key: "WINS", n: wins },
    { key: "LOSSES", n: losses },
    { key: "VOIDS", n: voids },
  ];
  const hovered = seg != null ? segMeta[seg] : null;

  return (
    <ChartPanel
      label="WIN RATE · DECIDED LAPS"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="WINS" />
          <LegendSwatch color={CH.ember} label="LOSSES" />
          <LegendSwatch color={CH.foam} label="VOIDS" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative flex w-full justify-center px-4 pb-2 pt-3">
        {total === 0 ? (
          <ChartEmpty height={SIZE} note="win rate needs a decided lap" />
        ) : (
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="block"
              role="img"
              aria-label={ariaSummary}
            >
              {/* lane ticks ring — same rhythm as the LapRing */}
              <g opacity="0.35">
                {Array.from({ length: 48 }, (_, i) => {
                  const a = (i / 48) * Math.PI * 2;
                  const r1 = 84;
                  const r2 = 89;
                  return (
                    <line
                      key={i}
                      x1={SIZE / 2 + Math.cos(a) * r1}
                      y1={SIZE / 2 + Math.sin(a) * r1}
                      x2={SIZE / 2 + Math.cos(a) * r2}
                      y2={SIZE / 2 + Math.sin(a) * r2}
                      stroke={CH.foam}
                      strokeWidth="1.6"
                    />
                  );
                })}
              </g>

              {/* base ring */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={CH.lined}
                strokeWidth={SW}
              />

              <motion.g
                initial={{ opacity: 0, rotate: -28 }}
                whileInView={{ opacity: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ transformOrigin: "center" }}
              >
                {segments.map((s, i) => (
                  <circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={seg === i ? SW + 4 : SW}
                    strokeLinecap="butt"
                    pathLength={1}
                    strokeDasharray={`${Math.max(0, s.frac - GAP).toFixed(4)} ${(
                      1 - Math.max(0, s.frac - GAP)
                    ).toFixed(4)}`}
                    strokeDashoffset={(-s.start).toFixed(4)}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    opacity={seg == null || seg === i ? 1 : 0.35}
                    style={{ transition: "stroke-width 160ms ease, opacity 160ms ease" }}
                    onPointerEnter={() => setSeg(i)}
                    onPointerLeave={() => setSeg(null)}
                  />
                ))}
              </motion.g>
            </svg>

            {/* center readout */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div className="flex flex-col items-center">
                <span className="data text-3xl font-semibold leading-none text-cream">
                  {winRate == null ? "—" : pct(winRate)}
                </span>
                <span className="data mt-2 text-[0.65rem] text-foam">
                  {wins}W · {losses}L · {voids}V
                </span>
                <span className="mlabel mt-1.5 text-foam/50">DECIDED = W + L</span>
              </div>
            </div>

            {hovered && (
              <ChartTip
                x={SIZE / 2}
                y={2}
                viewW={w || SIZE}
                flip={false}
                title={hovered.key}
                lines={[
                  { k: "LAPS", v: hovered.n },
                  { k: "SHARE", v: pct(hovered.n / total) },
                  ...(hovered.key === "WINS" && winRate != null
                    ? [{ k: "WIN RATE", v: pct(winRate), tone: "lime" as const }]
                    : []),
                ]}
              />
            )}
          </div>
        )}
      </div>
    </ChartPanel>
  );
}
