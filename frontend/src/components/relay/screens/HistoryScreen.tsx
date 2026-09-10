"use client";

/**
 * RELAY — HISTORY ("THE TAPE").
 * The verified ledger of every settled lap: fills, oracle answers,
 * claims — each row opens its full receipt. Stats strip sticks, chips
 * filter, CSV/JSON export the whole tape for real.
 */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { FileJson, FileSpreadsheet, X } from "lucide-react";
import { useRelay } from "@/lib/relay/engine/store";
import { useToast } from "@/hooks/use-toast";
import { pct, signed } from "@/lib/relay/format";
import { FlameMark } from "../identity/identity";
import { cn } from "@/lib/utils";
import { TAPE_GRID } from "./history/bits";
import { downloadTapeCsv, downloadTapeJson } from "./history/export";
import { EmptyTape } from "./history/EmptyTape";
import { TapeRow } from "./history/TapeRow";

type OutFilter = "ALL" | "WINS" | "LOSSES" | "VOID" | "SHIELDED";
type AssetFilter = "BOTH" | "BTC" | "ETH";

/* ── sticky strip stat ───────────────────────────────────────── */

function TapeStat({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: ReactNode;
  tone?: "cream" | "lime" | "ember" | "flame";
}) {
  const tones = {
    cream: "text-cream",
    lime: "text-lime",
    ember: "text-ember",
    flame: "text-flame",
  } as const;
  return (
    <div>
      <dt className="mlabel text-foam/75">{label}</dt>
      <dd className={cn("data mt-1 text-base font-semibold leading-none", tones[tone])}>
        {value}
      </dd>
    </div>
  );
}

/* ── screen ──────────────────────────────────────────────────── */

export function HistoryScreen() {
  const laps = useRelay((s) => s.laps);
  const runner = useRelay((s) => s.runner);
  // coarse clock (30s buckets) so "ago" labels tick without re-rendering the tape 4×/s
  const nowBucket = useRelay((s) => Math.floor(s.now / 30_000));
  const { toast } = useToast();

  const [filter, setFilter] = useState<OutFilter>("ALL");
  const [asset, setAsset] = useState<AssetFilter>("BOTH");
  const [openLap, setOpenLap] = useState<number | null>(null);

  const stats = useMemo(() => {
    const wins = laps.filter((l) => l.outcome === "WIN").length;
    const losses = laps.filter((l) => l.outcome === "LOSS").length;
    const voids = laps.filter((l) => l.outcome === "VOID").length;
    const shielded = laps.filter((l) => l.shielded).length;
    const decided = wins + losses;
    const net = +laps.reduce((s, l) => s + l.pnl, 0).toFixed(2);
    const bestStreak = laps.reduce((m, l) => Math.max(m, l.streakAfter), 0);
    return { wins, losses, voids, shielded, decided, net, bestStreak };
  }, [laps]);

  const filtered = useMemo(() => {
    const byOutcome =
      filter === "ALL"
        ? laps
        : filter === "SHIELDED"
          ? laps.filter((l) => l.shielded)
          : laps.filter((l) =>
              filter === "WINS"
                ? l.outcome === "WIN"
                : filter === "LOSSES"
                  ? l.outcome === "LOSS"
                  : l.outcome === "VOID",
            );
    const byAsset =
      asset === "BOTH" ? byOutcome : byOutcome.filter((l) => l.market.asset === asset);
    return [...byAsset].sort((a, b) => b.number - a.number); // newest first
  }, [laps, filter, asset]);

  const counts: Record<OutFilter, number> = {
    ALL: laps.length,
    WINS: stats.wins,
    LOSSES: stats.losses,
    VOID: stats.voids,
    SHIELDED: stats.shielded,
  };

  const onExport = (kind: "csv" | "json") => {
    if (laps.length === 0) return;
    const name = kind === "csv" ? downloadTapeCsv(laps) : downloadTapeJson(laps);
    toast({
      title: "Tape exported",
      description: `${laps.length} laps · ${name} — every fill, settlement and claim hash.`,
    });
  };

  const now = nowBucket * 30_000;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* ── header ── */}
        <header>
          <div className="flex items-center gap-2">
            <FlameMark className="h-4 w-4" aria-hidden />
            <span className="mlabel text-flame">THE TAPE</span>
          </div>
          <h1 className="mt-2 text-3xl font-black wide leading-[0.95] tracking-[-0.01em] sm:text-4xl">
            Every lap, on the record.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foam">
            Settled laps with their fills, oracle answers and claims. Every row
            opens its receipt.
          </p>
        </header>

        {/* ── sticky summary strip ── */}
        <div
          className={cn(
            "sticky top-0 z-30 -mx-4 mt-5 border-y-2 border-lined bg-panel/80 px-4 py-3 backdrop-blur",
            "sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <dl className="grid flex-1 grid-cols-3 gap-x-4 gap-y-2.5 sm:grid-cols-5">
              <TapeStat label="LAPS" value={laps.length} />
              <TapeStat
                label="WIN RATE"
                value={stats.decided > 0 ? pct(stats.wins / stats.decided) : "—"}
              />
              <TapeStat
                label="NET PNL"
                value={laps.length === 0 ? "—" : signed(stats.net)}
                tone={stats.net > 0 ? "lime" : stats.net < 0 ? "ember" : "cream"}
              />
              <TapeStat label="BEST STREAK" value={`×${stats.bestStreak}`} tone="flame" />
              <TapeStat label="SHIELDED" value={stats.shielded} />
            </dl>
            <div className="flex shrink-0 gap-2 lg:ml-4">
              <button
                type="button"
                onClick={() => onExport("csv")}
                disabled={laps.length === 0}
                className={cn(
                  "mlabel inline-flex items-center gap-1.5 rounded-lg border-2 border-lined bg-panel/60 px-3 py-2 text-cream transition-colors",
                  "hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-lined disabled:hover:text-cream"
                )}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
              <button
                type="button"
                onClick={() => onExport("json")}
                disabled={laps.length === 0}
                className={cn(
                  "mlabel inline-flex items-center gap-1.5 rounded-lg border-2 border-lined bg-panel/60 px-3 py-2 text-cream transition-colors",
                  "hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-lined disabled:hover:text-cream"
                )}
              >
                <FileJson className="h-3.5 w-3.5" aria-hidden />
                JSON
              </button>
            </div>
          </div>
        </div>

        {laps.length === 0 ? (
          <EmptyTape runner={runner} />
        ) : (
          <>
            {/* ── filter row ── */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Outcome filter" className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "ALL", label: "ALL" },
                    { key: "WINS", label: "WINS" },
                    { key: "LOSSES", label: "LOSSES" },
                    { key: "VOID", label: "VOID" },
                    { key: "SHIELDED", label: "SHIELDED" },
                  ] as { key: OutFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={cn(
                      "mlabel rounded-full border-2 px-3 py-1.5 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                      filter === f.key
                        ? "border-lime bg-lime text-graphite"
                        : "border-lined text-foam hover:border-foam/40 hover:text-cream"
                    )}
                  >
                    {f.label}{" "}
                    <span className={cn("tabular-nums", filter === f.key ? "opacity-70" : "opacity-60")}>
                      {counts[f.key]}
                    </span>
                  </button>
                ))}
              </div>
              <div
                role="group"
                aria-label="Asset filter"
                className="ml-auto flex gap-1 rounded-full border-2 border-lined bg-panel p-1"
              >
                {(["BOTH", "BTC", "ETH"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAsset(a)}
                    aria-pressed={asset === a}
                    className={cn(
                      "mlabel rounded-full px-3 py-1 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                      asset === a
                        ? "bg-lime text-graphite"
                        : "text-foam hover:text-cream"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* ── column header (desktop) ── */}
            <div
              className={cn(
                "mt-4 hidden items-center gap-3 border-b-2 border-lined px-4 pb-2 lg:grid",
                TAPE_GRID
              )}
              aria-hidden
            >
              <span className="mlabel text-foam/60">№</span>
              <span className="mlabel text-foam/60">MARKET</span>
              <span className="mlabel text-foam/60">SIDE</span>
              <span className="mlabel text-foam/60">STAKE · ENTRY</span>
              <span className="mlabel text-foam/60">OUTCOME</span>
              <span className="mlabel text-foam/60">PNL</span>
              <span className="mlabel text-foam/60">STREAK</span>
              <span className="mlabel text-foam/60">SETTLED</span>
              <span />
            </div>

            {/* ── the tape ── */}
            <div className="border-t-2 border-lined lg:border-t-0">
              <AnimatePresence initial={false}>
                {filtered.map((lap, i) => (
                  <motion.div
                    key={lap.number}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.015, 0.25) }}
                  >
                    <TapeRow
                      lap={lap}
                      now={now}
                      open={openLap === lap.number}
                      onToggle={() =>
                        setOpenLap((cur) => (cur === lap.number ? null : lap.number))
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <span className="mlabel text-foam/70">
                    NOTHING ON THE TAPE FOR THIS FILTER
                  </span>
                  <span className="serif-accent text-lg text-foam">
                    The record is longer than the slice.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("ALL");
                      setAsset("BOTH");
                    }}
                    className="mlabel inline-flex items-center gap-1.5 rounded-lg border-2 border-lined px-3 py-2 text-foam transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    CLEAR FILTERS
                  </button>
                </div>
              )}
            </div>

            {/* ── tape footer ── */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="data text-[0.65rem] text-foam/60">
                {filtered.length} of {laps.length} laps shown · reverse chronological ·
                receipts sealed on Somnia
              </span>
            </div>
          </>
        )}
      </div>
    </MotionConfig>
  );
}
