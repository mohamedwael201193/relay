"use client";

/**
 * RELAY — PnlByAsset.
 * BTC vs ETH attribution as diverging lanes: net pnl grows right of the
 * zero axis (lime) or left of it (ember), with per-asset lap counts and
 * win rates. Hover a lane for the full mono breakdown.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import type { AssetId } from "@/lib/relay/types";
import { pct, signed } from "@/lib/relay/format";
import { AssetIcon } from "../identity/identity";
import {
  CH,
  ChartEmpty,
  ChartPanel,
  ChartSummary,
  ChartTip,
  LegendSwatch,
  useChartWidth,
} from "./kit";

export interface AssetLane {
  asset: AssetId;
  pnl: number;
  laps: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface Props {
  lanes: AssetLane[];
  ariaSummary: string;
  className?: string;
}

export function PnlByAsset({ lanes, ariaSummary, className }: Props) {
  const [ref, w] = useChartWidth();
  const [hoverLane, setHoverLane] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const maxAbs = Math.max(0.01, ...lanes.map((l) => Math.abs(l.pnl)));

  const laneH = 64;
  const height = Math.max(150, lanes.length * laneH + 18);

  const onMove = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    const host = ref.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setHoverLane(i);
    setTipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hovered = hoverLane != null ? lanes[hoverLane] : null;

  return (
    <ChartPanel
      label="PNL BY ASSET · ATTRIBUTION"
      className={className}
      legend={
        <>
          <LegendSwatch color={CH.lime} label="NET POSITIVE" />
          <LegendSwatch color={CH.ember} label="NET NEGATIVE" />
          <LegendSwatch color={CH.foam} label="ZERO AXIS" shape="line" />
        </>
      }
    >
      <ChartSummary text={ariaSummary} />
      <div ref={ref} className="relative w-full px-5 pb-3 pt-2" style={{ minHeight: height }}>
        {lanes.length === 0 ? (
          <ChartEmpty height={height} note="asset attribution needs settled laps" />
        ) : (
          <div className="relative flex flex-col gap-4" style={{ minHeight: height - 12 }}>
            {/* shared zero axis */}
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, ${CH.foam} 0 5px, transparent 5px 10px)`,
                opacity: 0.5,
              }}
              aria-hidden
            />
            {lanes.map((lane, i) => {
              const half = (w - 40) / 2 - 4;
              const barW = Math.max(6, (Math.abs(lane.pnl) / maxAbs) * half);
              const positive = lane.pnl >= 0;
              return (
                <motion.div
                  key={lane.asset}
                  initial={{ opacity: 0, x: positive ? -10 : 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.08 }}
                  className="relative z-10"
                  onPointerMove={(e) => onMove(e, i)}
                  onPointerDown={(e) => onMove(e, i)}
                  onPointerLeave={() => setHoverLane(null)}
                  style={{ minHeight: laneH - 10, touchAction: "pan-y" }}
                >
                  {/* header row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AssetIcon asset={lane.asset} size={20} />
                      <span className="text-sm font-bold">{lane.asset}</span>
                      <span className="mlabel text-foam/70">
                        {lane.laps} LAPS · {pct(lane.winRate, 0)} WIN
                      </span>
                    </div>
                    <span
                      className="data text-lg font-semibold leading-none"
                      style={{ color: positive ? CH.lime : CH.ember }}
                    >
                      {signed(lane.pnl)}
                    </span>
                  </div>
                  {/* the lane */}
                  <div className="relative mt-2 h-5 rounded-md border-2 border-lined/80 bg-panel2/50">
                    <motion.div
                      className="absolute top-0 h-full rounded-[4px]"
                      style={{
                        background: positive ? CH.lime : CH.ember,
                        boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,0.4)",
                        left: positive ? "50%" : undefined,
                        right: positive ? undefined : "50%",
                      }}
                      initial={{ width: 0 }}
                      whileInView={{ width: barW }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.55, delay: 0.15 + i * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                    {/* end tick */}
                    <span
                      className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2"
                      style={{
                        background: positive ? "#6fa51e" : "#c23a15",
                        left: positive ? `calc(50% + ${barW}px - 2px)` : undefined,
                        right: positive ? undefined : `calc(50% + ${barW}px - 2px)`,
                        opacity: 0.9,
                      }}
                      aria-hidden
                    />
                  </div>
                </motion.div>
              );
            })}

            {hovered && (
              <ChartTip
                x={tipPos.x}
                y={tipPos.y - 6}
                viewW={w}
                flip={tipPos.y < 90}
                title={`${hovered.asset} · NET`}
                lines={[
                  { k: "LAPS", v: hovered.laps },
                  { k: "W / L", v: `${hovered.wins} / ${hovered.losses}` },
                  { k: "WIN RATE", v: pct(hovered.winRate) },
                  {
                    k: "NET PNL",
                    v: signed(hovered.pnl),
                    tone: hovered.pnl > 0 ? "lime" : hovered.pnl < 0 ? "ember" : "foam",
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </ChartPanel>
  );
}
