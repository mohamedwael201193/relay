"use client";

/**
 * RELAY — PnlByHour.
 * Session rhythm: net pnl per 4-hour bucket as diverging bars from a
 * dashed zero axis — up lime / down ember. Mono value labels, hour
 * axis, hover readout with laps + win rate.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { pct, signed } from "@/lib/relay/format";
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

export interface HourBucket {
  label: string;
  laps: number;
  wins: number;
  pnl: number;
  winRate: number;
}

interface Props {
  buckets: HourBucket[];
  ariaSummary: string;
  className?: string;
}

export function PnlByHour({ buckets, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [idx, setIdx] = useState<number | null>(null);

  const H = 192;
  const padL = 10;
  const padR = 10;
  const padT = 28;
  const padB = 22;

  const geo = useMemo(() => {
    if (buckets.length === 0 || w <= padL + padR + 20) return null;
    const innerW = w - padL - padR - 8;
    const step = innerW / buckets.length;
    const barW = Math.max(8, Math.min(46, step * 0.6));
    const xs = buckets.map((_, i) => padL + 4 + step * (i + 0.5));
    const zeroY = padT + (H - padT - padB) / 2;
    const halfH = (H - padT - padB) / 2;
    const maxAbs = Math.max(0.01, ...buckets.map((b) => Math.abs(b.pnl)));
    const hs = buckets.map((b) => Math.max(3, (Math.abs(b.pnl) / maxAbs) * (halfH - 14)));
    return { step, barW, xs, zeroY, hs };
  }, [buckets, w]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    setIdx(nearestIndex(localX(e), geo.xs));
  };

  const hovered = idx != null && geo ? buckets[idx] : null;

  return (
    <ChartPanel
      label="PNL BY SESSION HOUR · 4H BUCKETS"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="NET POSITIVE" />
          <LegendSwatch color={CH.ember} label="NET NEGATIVE" />
          <LegendSwatch color={CH.foam} label="ZERO" shape="line" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative w-full px-2 pt-1" style={{ height: H }}>
        {!geo ? (
          <ChartEmpty height={H - 4} note="hour buckets fill as the session runs" />
        ) : (
          <>
            <svg
              width={Math.max(0, w - 16)}
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
              {/* hover column */}
              {idx != null && (
                <rect
                  x={geo.xs[idx] - geo.step / 2}
                  y={padT - 8}
                  width={geo.step}
                  height={H - padT - padB + 12}
                  fill={CH.cream}
                  opacity="0.06"
                  rx="3"
                />
              )}

              {/* zero axis */}
              <line
                x1={2}
                x2={Math.max(0, w - 16) - 6}
                y1={geo.zeroY}
                y2={geo.zeroY}
                stroke={CH.foam}
                strokeWidth="1.6"
                strokeDasharray="6 6"
                opacity="0.6"
              />
              <text
                x={4}
                y={geo.zeroY - 5}
                fontSize="8"
                fill={CH.foam}
                opacity="0.55"
                fontFamily="var(--font-data)"
                letterSpacing="0.1em"
              >
                $0
              </text>

              {/* bars */}
              {buckets.map((b, i) => {
                const positive = b.pnl >= 0;
                const h = geo.hs[i];
                const y = positive ? geo.zeroY - h - 1 : geo.zeroY + 1;
                const labelY = positive ? y - 5 : y + h + 10;
                return (
                  <g key={b.label}>
                    <motion.rect
                      x={geo.xs[i] - geo.barW / 2}
                      y={y}
                      width={geo.barW}
                      height={h}
                      rx="2.5"
                      fill={positive ? CH.lime : CH.ember}
                      stroke={CH.graphite}
                      strokeWidth="1.4"
                      initial={{ opacity: 0, scaleY: 0.3 }}
                      whileInView={{ opacity: 1, scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
                      style={{ transformOrigin: `${geo.xs[i]}px ${geo.zeroY}px` }}
                    />
                    {/* value label */}
                    <text
                      x={geo.xs[i]}
                      y={labelY}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontFamily="var(--font-data)"
                      fill={positive ? CH.lime : CH.ember}
                      opacity="0.95"
                    >
                      {signed(b.pnl, Math.abs(b.pnl) < 10 ? 2 : 0)}
                    </text>
                    {/* hour label */}
                    <text
                      x={geo.xs[i]}
                      y={H - 7}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontFamily="var(--font-data)"
                      fill={CH.foam}
                      opacity="0.8"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

              {/* crosshair */}
              {idx != null && (
                <line
                  x1={geo.xs[idx]}
                  x2={geo.xs[idx]}
                  y1={padT - 10}
                  y2={H - padB}
                  stroke={CH.cream}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.35"
                />
              )}
            </svg>

            {hovered && (
              <ChartTip
                x={geo.xs[idx!]}
                y={hovered.pnl >= 0 ? geo.zeroY - geo.hs[idx!] - 14 : geo.zeroY + 14}
                viewW={Math.max(0, w - 16)}
                flip={hovered.pnl < 0}
                title={`${hovered.label} SESSION`}
                lines={[
                  {
                    k: "PNL",
                    v: signed(hovered.pnl),
                    tone: hovered.pnl > 0 ? "lime" : hovered.pnl < 0 ? "ember" : "foam",
                  },
                  { k: "LAPS", v: hovered.laps },
                  { k: "WIN RATE", v: pct(hovered.winRate) },
                ]}
              />
            )}
          </>
        )}
      </div>
    </ChartPanel>
  );
}
