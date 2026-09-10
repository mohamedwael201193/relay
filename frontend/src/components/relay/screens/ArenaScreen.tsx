"use client";

/**
 * RELAY — THE ARENA.
 * A live sports leaderboard over the verified runner set: podium, racing
 * lanes that re-sort as laps settle, and a live boost ticker. Every
 * number comes from the store's `arena` array (derived from on-chain
 * fills) — ranks genuinely move while you watch.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Bookmark } from "lucide-react";

import { useRelay } from "@/lib/relay/engine/store";
import { cn } from "@/lib/utils";
import { LiveDot, Panel } from "../core/primitives";
import { FlameMark } from "../identity/identity";
import { Lane } from "./arena/lane";
import { Podium } from "./arena/podium";
import { BoostTicker } from "./arena/ticker";

type Filter = "ALL" | "FOLLOWING";

export function ArenaScreen() {
  const arena = useRelay((s) => s.arena);
  const following = useRelay((s) => s.following);
  const selectRunner = useRelay((s) => s.selectRunner);
  const toggleFollow = useRelay((s) => s.toggleFollow);
  const [filter, setFilter] = useState<Filter>("ALL");

  const sorted = useMemo(() => [...arena].sort((a, b) => a.rank - b.rank), [arena]);
  const podium = filter === "ALL" ? sorted.slice(0, 3) : [];
  const lanes = useMemo(
    () =>
      filter === "ALL"
        ? sorted.slice(3)
        : sorted.filter((a) => following.includes(a.runnerId)),
    [filter, sorted, following]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        {/* ── header ── */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FlameMark className="h-4 w-4" aria-hidden />
              <span className="mlabel text-flame">THE ARENA</span>
            </div>
            <h1 className="mt-2 text-3xl font-black wide leading-[0.95] tracking-[-0.01em] sm:text-4xl">
              Every streak is public.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-foam">
              Ranked by 7-day verified PnL. Every number derived from on-chain
              fills — ranks move every window.
            </p>
            <div className="mt-3.5">
              <LiveDot label="LIVE · REFRESHES EVERY WINDOW" />
            </div>
          </div>

          {/* filter */}
          <div
            role="group"
            aria-label="Arena filter"
            className="flex shrink-0 self-start gap-1 rounded-full border-2 border-lined bg-panel p-1"
          >
            {(["ALL", "FOLLOWING"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "mlabel rounded-full px-3.5 py-2.5 transition-colors sm:py-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                  filter === f ? "bg-lime text-graphite" : "text-foam hover:text-cream"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {/* ── live boost ticker ── */}
        <div className="mt-5">
          <BoostTicker />
        </div>

        {/* ── podium (ALL only) ── */}
        {filter === "ALL" && podium.length === 3 && (
          <section className="mt-6" aria-label="Podium, top three runners by 7-day PnL">
            <div className="mb-3 flex items-center gap-2">
              <FlameMark className="h-3.5 w-3.5" aria-hidden />
              <span className="mlabel text-foam/70">PODIUM · TOP 3 · 7-DAY VERIFIED PNL</span>
            </div>
            <Podium runners={podium} />
          </section>
        )}

        {/* ── lanes ── */}
        {filter === "FOLLOWING" && lanes.length === 0 ? (
          <EmptyFollowing onBrowse={() => setFilter("ALL")} />
        ) : (
          <section className="mt-6" aria-label="Arena lanes">
            <Panel
              className="overflow-hidden"
              label={
                filter === "ALL"
                  ? `THE LANES · RANKS 4–${sorted.length} · SORTED BY 7D PNL`
                  : `YOUR LANES · ${lanes.length} FOLLOWED`
              }
            >
              <motion.div role="list" className="pb-1 pt-1">
                <AnimatePresence initial={false}>
                  {lanes.map((entry) => (
                    <Lane
                      key={entry.runnerId}
                      entry={entry}
                      following={following.includes(entry.runnerId)}
                      onOpen={selectRunner}
                      onToggleFollow={toggleFollow}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </Panel>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="mlabel text-foam/50">
                ▲ CLIMBED LAST WINDOW · ▼ DROPPED · PNL = 7-DAY VERIFIED
              </span>
              <span className="mlabel text-foam/50">{sorted.length} RUNNERS ON TAPE</span>
            </div>
          </section>
        )}
      </div>
    </MotionConfig>
  );
}

function EmptyFollowing({ onBrowse }: { onBrowse: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="mt-6"
      aria-label="No runners followed yet"
    >
      <Panel className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <Bookmark className="h-10 w-10 text-foam/40" aria-hidden />
        <div className="text-lg font-black wide">You&rsquo;re not following anyone yet.</div>
        <p className="max-w-sm text-sm leading-relaxed text-foam">
          Tap the bookmark on any lane to pin runners here — their laps, streaks
          and rank moves land in your feed.
        </p>
        <button
          type="button"
          onClick={onBrowse}
          className="mt-1 rounded-xl border-2 border-lime bg-lime px-5 py-3 font-black wide text-sm text-graphite hardshadow-d transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          BROWSE ALL
        </button>
      </Panel>
    </motion.section>
  );
}
