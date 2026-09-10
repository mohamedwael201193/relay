"use client";

/**
 * RELAY — alert feed row + kind iconography.
 * One notification kind = one unmistakable mark: fills carry the baton,
 * wins/losses the direction arrows, streaks the flame, shields the shield.
 */

import { motion } from "framer-motion";
import { BadgeCheck, ChevronRight, Info, Minus, Rocket, Trophy, Zap } from "lucide-react";

import type { AppNotification, NotificationKind } from "@/lib/relay/types";
import { clock } from "@/lib/relay/format";
import { cn } from "@/lib/utils";
import {
  BatonGlyph,
  DownMark,
  FlameMark,
  ShieldMark,
  UpMark,
} from "../../identity/identity";

/* ── kind → icon (inside the 44px tile) ─────────────────────── */

function KindIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "FILL":
      return <BatonGlyph className="w-7" aria-hidden />;
    case "WIN":
      return <UpMark className="h-6 w-6" aria-hidden />;
    case "LOSS":
      return <DownMark className="h-6 w-6" aria-hidden />;
    case "VOID":
      return <Minus className="h-5 w-5 text-foam" aria-hidden />;
    case "STREAK":
      return <FlameMark className="h-6 w-6" aria-hidden />;
    case "SHIELD":
      return <ShieldMark className="h-6 w-6" aria-hidden />;
    case "CLAIM":
      return <BadgeCheck className="h-5 w-5 text-lime" aria-hidden />;
    case "BOOST":
      return <Zap className="h-5 w-5 text-flame" aria-hidden />;
    case "ARENA":
      return <Trophy className="h-5 w-5 text-flame" aria-hidden />;
    case "DEPLOY":
      return <Rocket className="h-5 w-5 text-lime" aria-hidden />;
    default:
      return <Info className="h-5 w-5 text-foam" aria-hidden />;
  }
}

/* ── hour buckets ───────────────────────────────────────────── */

export type BucketKey = "recent" | "hour" | "earlier";

export const BUCKET_LABELS: Record<BucketKey, string> = {
  recent: "LAST 15 MINUTES",
  hour: "THIS HOUR",
  earlier: "EARLIER",
};

export function bucketOf(at: number, now: number): BucketKey {
  const age = now - at;
  if (age < 15 * 60_000) return "recent";
  if (age < 60 * 60_000) return "hour";
  return "earlier";
}

/* ── feed row ───────────────────────────────────────────────── */

export interface RowProps {
  n: AppNotification;
  unread: boolean;
  /** WIN/LOSS/VOID row matching the latest result — offer the receipt. */
  canViewResult: boolean;
  last?: boolean;
  onRead: () => void;
  onOpenResult: () => void;
}

export function NotificationRow({ n, unread, canViewResult, last, onRead, onOpenResult }: RowProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative list-none"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onRead}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRead();
          }
        }}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel2/40",
          "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-lime",
          unread ? "bg-panel2/20" : "bg-transparent",
          last ? "border-b-0" : "border-b border-lined"
        )}
      >
        {unread && (
          <span
            className="absolute left-[7px] top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-lime"
            aria-hidden
          />
        )}
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-lined bg-panel2">
          <KindIcon kind={n.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-cream">{n.title}</div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foam">{n.body}</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="data text-[10px] text-foam/70">{clock(n.at)}</span>
            {n.lap != null && (
              <span className="data rounded-md border border-lined px-1.5 py-0.5 text-[10px] text-foam/80">
                LAP {n.lap}
              </span>
            )}
            <span className="mlabel ml-auto text-foam/40">{n.kind}</span>
          </div>
        </div>
        {canViewResult && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenResult();
            }}
            className="mlabel flex min-h-[36px] shrink-0 items-center gap-1 self-center rounded-lg border-2 border-limedeep/50 px-2.5 text-lime transition-colors hover:bg-lime hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            VIEW RESULT
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </motion.li>
  );
}

/* ── empty state — the resting baton ────────────────────────── */

export function EmptyFeed({
  hasRunner,
  onDeploy,
  onWatch,
}: {
  hasRunner: boolean;
  onDeploy: () => void;
  onWatch: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
      <div className="flex flex-col items-center gap-4" aria-hidden>
        <BatonGlyph className="w-24 opacity-90" />
        <span className="track-dash w-44 text-lined" />
      </div>
      <h3 className="mt-7 text-lg font-black wide text-cream">Nothing yet.</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-foam">
        Deploy a runner and the feed wakes up — fills, settles, streaks, shields and
        boosts land here the moment they happen on-chain.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!hasRunner && (
          <button
            type="button"
            onClick={onDeploy}
            className="mlabel min-h-[44px] rounded-xl border-2 border-lime bg-lime px-5 py-3 text-graphite hardshadow-d transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            DEPLOY A RUNNER
          </button>
        )}
        {hasRunner && (
          <button
            type="button"
            onClick={onWatch}
            className="mlabel min-h-[44px] rounded-xl border-2 border-lined px-5 py-3 text-foam transition-colors hover:border-foam/60 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            WATCH THE LIVE LAP
          </button>
        )}
      </div>
    </div>
  );
}
