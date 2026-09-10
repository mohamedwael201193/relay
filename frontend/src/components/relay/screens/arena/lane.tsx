"use client";

/**
 * RELAY — one racing lane of the arena.
 *
 * Rank movement: the store recomputes `delta` when ranks reshuffle
 * (delta = oldRank − newRank), so a POSITIVE delta means the runner
 * CLIMBED — rendered as a lime ▲ with a spring pop on change.
 * The row itself carries framer-motion `layout`, so when the arena
 * re-sorts, lanes slide to their new positions instead of teleporting.
 */

import { motion } from "framer-motion";
import { BadgeCheck, Bookmark } from "lucide-react";

import { pct, signed } from "@/lib/relay/format";
import type { ArenaRunner } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "../../core/primitives";
import { FlameMark, RunnerGlyph } from "../../identity/identity";

export function Lane({
  entry,
  following,
  onOpen,
  onToggleFollow,
}: {
  entry: ArenaRunner;
  following: boolean;
  onOpen: (runnerId: string) => void;
  onToggleFollow: (runnerId: string) => void;
}) {
  const up = entry.pnl7d >= 0;

  return (
    <motion.div
      role="listitem"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 44 },
        duration: 0.22,
      }}
      className={cn(
        "border-b border-lined last:border-b-0",
        entry.isYou && "border-l-4 border-l-lime bg-panel"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry.runnerId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(entry.runnerId);
          }
        }}
        aria-label={`View ${entry.name}, rank ${entry.rank}, streak ×${entry.streak}, 7-day PnL ${signed(entry.pnl7d)}`}
        className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-panel2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime sm:gap-4"
      >
        {/* rank + movement */}
        <div className="w-12 shrink-0">
          <div className="data text-xl font-bold tabular-nums leading-none">{entry.rank}</div>
          <RankDelta id={entry.runnerId} v={entry.delta} />
        </div>

        {/* glyph */}
        <RunnerGlyph hue={entry.glyph.hue} shape={entry.glyph.shape} size={44} dark />

        {/* identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold leading-tight">{entry.name}</span>
            {entry.isYou && (
              <span className="mlabel shrink-0 rounded bg-lime px-1.5 py-px text-graphite">YOU</span>
            )}
            {entry.verified && (
              <BadgeCheck
                className="h-4 w-4 shrink-0 text-lime"
                aria-label="Verified — fills on-chain"
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="data text-[0.7rem] text-foam">{entry.ownerHandle}</span>
            <span className="mlabel hidden text-foam/50 md:inline">{entry.strategy}</span>
            <StatusDot status={entry.status} />
            {/* compact streak on mobile (stats hidden below md) */}
            <span className="inline-flex items-center gap-1 md:hidden">
              <FlameMark className="h-3.5 w-3.5" aria-hidden />
              <span className="data text-xs font-semibold text-flame">×{entry.streak}</span>
            </span>
          </div>
        </div>

        {/* spark — the bankroll trail */}
        <div className="hidden shrink-0 md:block">
          <Sparkline values={entry.spark} width={112} height={36} />
        </div>

        {/* stats */}
        <div className="hidden shrink-0 items-center gap-4 md:flex">
          <div className="flex w-14 items-center gap-1.5">
            <FlameMark className="h-4 w-4" aria-hidden />
            <span className="data text-sm font-semibold text-flame">×{entry.streak}</span>
          </div>
          <div className="w-11 text-right">
            <div className="data text-sm leading-none">{pct(entry.winRate, 0)}</div>
            <div className="mlabel mt-1 text-foam/60">WIN</div>
          </div>
          <div className="w-11 text-right">
            <div className="data text-sm leading-none">{entry.laps}</div>
            <div className="mlabel mt-1 text-foam/60">LAPS</div>
          </div>
          <div className="w-12 text-right">
            <div className="data text-sm leading-none">{entry.followers}</div>
            <div className="mlabel mt-1 text-foam/60">FOLLOW</div>
          </div>
        </div>

        {/* 7-day pnl */}
        <div className="shrink-0 text-right">
          <motion.div
            key={entry.pnl7d}
            initial={{ opacity: 0.45, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "data text-xl font-semibold leading-none",
              up ? "text-lime" : "text-ember"
            )}
          >
            {signed(entry.pnl7d)}
          </motion.div>
          <div className="mlabel mt-1.5 text-foam/60">7D</div>
        </div>

        {/* bookmark / follow */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFollow(entry.runnerId);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-pressed={following}
          aria-label={following ? `Unfollow ${entry.name}` : `Follow ${entry.name}`}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 transition-colors md:h-10 md:w-10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
            following ? "border-lime/60 bg-lime/10" : "border-lined hover:border-foam/40"
          )}
        >
          <Bookmark
            className={cn(
              "h-5 w-5 transition-colors",
              following ? "fill-lime text-lime" : "text-foam group-hover:text-cream"
            )}
            aria-hidden
          />
        </button>
      </div>

      {/* lane dashes — the track under every row */}
      <div className="track-dash mx-4 text-foam/15" aria-hidden />
    </motion.div>
  );
}

/** ▲ climbed / ▼ dropped, pops when the value changes. */
function RankDelta({ id, v }: { id: string; v: number }) {
  if (v === 0) return <div className="mt-1 h-3" aria-hidden />;
  const up = v > 0;
  return (
    <motion.span
      key={`${id}:${v}`}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 22 }}
      className={cn(
        "mt-1 block data text-[10px] font-semibold leading-none",
        up ? "text-lime" : "text-ember"
      )}
      aria-label={up ? `Climbed ${v} places last window` : `Dropped ${-v} places last window`}
    >
      {up ? `▲${v}` : `▼${-v}`}
    </motion.span>
  );
}

function StatusDot({ status }: { status: "RUNNING" | "PAUSED" }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Runner ${status}`}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "RUNNING" ? "bg-lime blink" : "bg-foam/50"
        )}
        aria-hidden
      />
      <span className="mlabel text-foam/70">{status}</span>
    </span>
  );
}
