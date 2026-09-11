"use client";

/**
 * RELAY — the public share card.
 * A screenshot-ready athlete card for any runner: logo, glyph, streak,
 * 7-day PnL, win rate, mini spark, verified seal and canonical URL.
 * Natural height on mobile, ~1.9:1 fixed ratio from md up.
 */

import { FlameMark, RelayLogo, RunnerGlyph, VerifiedSeal } from "../../identity/identity";
import { Sparkline } from "../../core/primitives";
import { pct, signed } from "@/lib/relay/format";
import type { ArenaRunner } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

export function ShareCard({ entry }: { entry: ArenaRunner }) {
  const host =
    typeof window !== "undefined" ? window.location.host : "relay-silk-one.vercel.app";

  return (
    <div
      role="img"
      aria-label={`${entry.name} public card — streak ×${entry.streak}, 7-day PnL ${signed(entry.pnl7d)}, win rate ${pct(entry.winRate)}`}
      className={cn(
        "grain grain-d relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-lined bg-panel2",
        "min-h-[300px] p-5 md:aspect-[1.9/1] sm:p-6"
      )}
    >
      {/* masthead */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <RelayLogo tone="lime" compact />
          <div className="mt-3 font-black wide text-2xl leading-none sm:text-3xl">
            {entry.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mlabel truncate rounded-full border-2 border-lined px-2.5 py-1 text-foam">
              {entry.strategy}
            </span>
            <span className="mlabel rounded-full border-2 border-lined px-2.5 py-1 text-foam">
              {pct(entry.winRate, 0)} WIN
            </span>
          </div>
        </div>
        <RunnerGlyph hue={entry.glyph.hue} shape={entry.glyph.shape} size={64} dark />
      </div>

      {/* headline row */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <FlameMark className="h-6 w-6" aria-hidden />
          <div>
            <div className="mlabel text-foam/70">STREAK</div>
            <div className="data text-3xl font-semibold leading-none text-flame">
              ×{entry.streak}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="mlabel text-foam/70">7D PNL</div>
          <div
            className={cn(
              "data text-3xl font-semibold leading-none sm:text-4xl",
              Number.isFinite(entry.pnl7d) && entry.pnl7d >= 0 ? "text-lime" : "text-ember"
            )}
          >
            {signed(entry.pnl7d)}
          </div>
        </div>
      </div>

      {/* performance trail — only when the tape produced a spark */}
      {entry.spark.length > 0 ? (
        <div className="mt-4">
          <Sparkline
            values={entry.spark}
            width={560}
            height={44}
            className="h-11 w-full"
            strokeWidth={2.5}
          />
        </div>
      ) : null}

      {/* verification footer */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <VerifiedSeal size={44} />
        <div className="flex min-w-0 flex-col items-end gap-1">
          <span className="data truncate text-xs text-foam">{host}</span>
          <span className="mlabel whitespace-nowrap text-foam/60">
            NUMBERS FROM VERIFIED FILLS
          </span>
        </div>
      </div>
    </div>
  );
}
