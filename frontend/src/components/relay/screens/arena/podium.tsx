"use client";

/**
 * RELAY — arena podium.
 * Top-3 athlete cards. DOM order is 1-2-3 but visual order is 2-1-3
 * (classic podium silhouette: silver left, gold elevated center, bronze
 * right). Whole card opens the runner's public profile.
 */

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { useRelay } from "@/lib/relay/engine/store";
import { pct, signed } from "@/lib/relay/format";
import type { ArenaRunner } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { FlameMark, RunnerGlyph } from "../../identity/identity";
import { isLiveMode } from "@/lib/relay/live/mode";

const MEDAL: Record<number, string> = {
  1: "bg-lime text-graphite",
  2: "bg-cream text-graphite",
  3: "bg-flame text-graphite",
};

/** index 0 = rank 1 (center, order-2), 1 = rank 2, 2 = rank 3 */
const ORDER = ["order-2", "order-1", "order-3"];

export function Podium({ runners }: { runners: ArenaRunner[] }) {
  const selectRunner = useRelay((s) => s.selectRunner);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-end">
      {runners.map((r, i) => (
        <motion.button
          key={r.runnerId}
          type="button"
          layout
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.28, ease: "easeOut" }}
          onClick={() => selectRunner(r.runnerId)}
          aria-label={`View ${r.name}, rank ${r.rank}, streak ×${r.streak}, 7-day PnL ${signed(r.pnl7d)}`}
          className={cn(
            "group rounded-2xl border-2 p-5 text-left hardshadow-d",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
            ORDER[i] ?? "",
            // elevated center: bottoms flush, gold card stands taller
            r.rank === 1 ? "border-lime bg-panel lg:pb-9" : "border-lined bg-panel"
          )}
        >
          {/* medal + you flag */}
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border-2 border-graphite",
                MEDAL[r.rank] ?? "bg-panel2 text-cream"
              )}
              aria-label={`Rank ${r.rank}`}
            >
              <span className="data text-sm font-bold leading-none">{r.rank}</span>
            </span>
            {r.isYou && (
              <span className="mlabel rounded bg-lime px-1.5 py-0.5 text-graphite">YOU</span>
            )}
          </div>

          {/* identity */}
          <div className="mt-3 flex items-center gap-3.5">
            <RunnerGlyph hue={r.glyph.hue} shape={r.glyph.shape} size={64} dark />
            <div className="min-w-0">
              <div className="truncate font-extrabold wide text-xl leading-tight">{r.name}</div>
              <div className="data mt-0.5 text-xs text-foam">{r.ownerHandle}</div>
            </div>
          </div>

          {/* headline numbers */}
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <FlameMark className="h-5 w-5" aria-hidden />
              <div>
                <div className="mlabel text-foam/60">STREAK</div>
                <div className="data text-2xl font-semibold leading-none text-flame">
                  ×{r.streak}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="mlabel text-foam/60">7D PNL</div>
              <motion.div
                key={r.pnl7d}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "data text-2xl font-semibold leading-none",
                  Number.isFinite(r.pnl7d) && r.pnl7d >= 0 ? "text-lime" : "text-ember"
                )}
              >
                {signed(r.pnl7d)}
              </motion.div>
            </div>
          </div>

          {/* footer stats */}
          <div className="mt-4 flex items-center justify-between border-t-2 border-lined pt-3">
            <span className="data text-xs text-foam">{pct(r.winRate, 0)} WIN</span>
            <span className="data text-xs text-foam">
              {isLiveMode() && r.followers === 0
                ? `${r.boosters} BOOST`
                : `${r.followers} FOLLOW · ${r.boosters} BOOST`}
            </span>
          </div>

          {/* affordance */}
          <div className="mt-3 flex items-center gap-1 mlabel text-lime">
            <span className="opacity-70 transition-opacity group-hover:opacity-100">
              VIEW RUNNER
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        </motion.button>
      ))}
    </div>
  );
}
