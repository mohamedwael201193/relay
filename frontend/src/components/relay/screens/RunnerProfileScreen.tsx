"use client";

/**
 * RELAY — RUNNER PROFILE.
 * A public athlete identity for a strategy: the athlete card (stats,
 * performance, boost/follow CTAs), the screenshot-ready share card,
 * the public lap tape, streak history and risk policy.
 * Your own runner doubles as your public card (real laps, real config);
 * other runners load public history + proof. Boost is not live.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Gauge,
  Share2,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

import { useRelay } from "@/lib/relay/engine/store";
import { relayApi, type ProofBundle } from "@/lib/relay/api/client";
import { lapsFromHistory } from "@/lib/relay/live/apply";
import { isLiveMode } from "@/lib/relay/live/mode";
import { ago, cents, money, pct, shortAddr, signed } from "@/lib/relay/format";
import type { ArenaRunner, Lap } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LiveDot, Panel, Sparkline, StatTile } from "../core/primitives";
import {
  AssetIcon,
  BatonGlyph,
  DownMark,
  FlameMark,
  RunnerGlyph,
  ShieldMark,
  UpMark,
} from "../identity/identity";
import { BoostDialog } from "./arena/boost-dialog";
import { ShareCard } from "./arena/share-card";
import {
  longestWinRange,
  slugFor,
  synthTape,
  synthTicks,
  ticksFromLaps,
} from "./arena/synth";

export function RunnerProfileScreen() {
  const arena = useRelay((s) => s.arena);
  const selectedId = useRelay((s) => s.selectedRunnerId);
  const goScreen = useRelay((s) => s.goScreen);
  const now = useRelay((s) => s.now);

  // selected runner → your own runner → empty state
  const entry = useMemo(
    () =>
      arena.find((a) => a.runnerId === selectedId) ??
      arena.find((a) => a.isYou) ??
      null,
    [arena, selectedId]
  );

  if (!entry) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 pb-28 text-center">
        <FlameMark className="h-10 w-10" aria-hidden />
        <div className="text-xl font-black wide">Pick a runner from the arena.</div>
        <p className="max-w-sm text-sm leading-relaxed text-foam">
          Every public runner has an athlete card — verified laps, streaks, and
          a public tape you can follow or boost.
        </p>
        <button
          type="button"
          onClick={() => goScreen("arena")}
          className="mt-1 rounded-xl border-2 border-lime bg-lime px-5 py-3 font-black wide text-sm text-graphite hardshadow-d transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          OPEN THE ARENA
        </button>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:pb-10"
      >
        <button
          type="button"
          onClick={() => goScreen("arena")}
          aria-label="Back to the arena"
          className="mlabel flex items-center gap-1.5 rounded-md px-1 py-0.5 text-foam transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> ARENA
        </button>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* ── the athlete card ── */}
          <AthleteCard entry={entry} />

          <div className="grid min-w-0 gap-6">
            {/* ── share / public card ── */}
            <section aria-label="Public share card">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="mlabel text-foam/70">
                  {entry.isYou ? "SHARE CARD" : "PUBLIC CARD"}
                </span>
                <span className="mlabel text-foam/40">
                  SCREENSHOT-READY · RECEIPT-BACKED NUMBERS
                </span>
              </div>
              <ShareCard entry={entry} />
            </section>

            <RecentLaps entry={entry} now={now} />
            <StreakHistory entry={entry} />
            <RiskPolicy entry={entry} />
            <FollowersRow entry={entry} />
          </div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

/* ── the athlete card (left column) ─────────────────────────── */

function AthleteCard({ entry }: { entry: ArenaRunner }) {
  const wallet = useRelay((s) => s.wallet);
  const config = useRelay((s) => s.config);
  const following = useRelay((s) => s.following);
  const toggleFollow = useRelay((s) => s.toggleFollow);
  const goScreen = useRelay((s) => s.goScreen);
  const { toast } = useToast();
  const [boostOpen, setBoostOpen] = useState(false);

  const isYou = !!entry.isYou;
  const isFollowing = following.includes(entry.runnerId);
  const address = isYou ? wallet.address : entry.ownerAddress ?? "";

  const share = async () => {
    const text = [
      `RELAY — ${entry.name} · ${entry.strategy}`,
      `7D PNL ${signed(entry.pnl7d)} · STREAK ×${entry.streak} · WIN RATE ${pct(entry.winRate)}`,
      `${entry.laps} LAPS · ${entry.followers} FOLLOWERS`,
      `relay.app/r/${slugFor(entry.name)} — every number verified on-chain`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable (insecure context) — the toast still confirms */
    }
    toast({
      title: "Card copied",
      description: "Numbers are receipt-backed — paste it anywhere.",
    });
  };

  return (
    <Panel className="self-start p-5 sm:p-6 lg:sticky lg:top-6">
      {/* glyph + status */}
      <div className="flex items-start justify-between gap-3">
        <RunnerGlyph hue={entry.glyph.hue} shape={entry.glyph.shape} size={88} dark />
        <StatusChip status={entry.status} />
      </div>

      <div className="mt-4 font-black wide text-2xl leading-none sm:text-3xl">
        {entry.name}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="data text-xs text-foam">{entry.ownerHandle}</span>
        <span className="text-foam/40" aria-hidden>
          ·
        </span>
        <span className="data text-xs text-foam/80" title={address}>
          {shortAddr(address)}
        </span>
      </div>

      {/* strategy chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>{entry.strategy}</Chip>
        <Chip>
          {entry.bias === "UP" ? (
            <>
              <UpMark className="h-3.5 w-3.5" aria-hidden /> UP BIAS
            </>
          ) : entry.bias === "DOWN" ? (
            <>
              <DownMark className="h-3.5 w-3.5" aria-hidden /> DOWN BIAS
            </>
          ) : (
            <>FOLLOW BOOK</>
          )}
        </Chip>
        <Chip>{isYou ? config.cadence.toUpperCase() : "15M"} CADENCE</Chip>
        {entry.verified && (
          <Chip className="border-lime/70 text-lime">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> VERIFIED
          </Chip>
        )}
      </div>

      {/* stats grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatTile
          label="7D PNL"
          value={signed(entry.pnl7d)}
          sub="VERIFIED FILLS"
          tone={entry.pnl7d >= 0 ? "up" : "down"}
        />
        <StatTile label="STREAK" value={`×${entry.streak}`} sub="CURRENT · LIVE" tone="flame" />
        <StatTile label="WIN RATE" value={pct(entry.winRate)} sub={`ON ${entry.laps} LAPS`} />
        <StatTile label="LAPS" value={entry.laps} sub="LIFETIME TAPE" />
        <StatTile label="BEST STREAK" value={`×${entry.bestStreak}`} sub="ALL-TIME" tone="flame" />
        <StatTile label="FOLLOWERS" value={entry.followers} sub="PUBLIC WATCHERS" />
      </div>

      {/* boosters */}
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border-2 border-lined bg-panel2/60 px-4 py-2.5">
        <BatonGlyph className="h-4 w-auto" aria-hidden />
        <span className="mlabel text-foam">
          BOOST DEPLOYS YOUR VAULT — CLONES BIAS, NOT THEIR FUNDS
        </span>
      </div>

      {/* performance */}
      <div className="mt-5">
        <div className="mlabel text-foam/70">PERFORMANCE · LAST 12 LAPS</div>
        <Sparkline
          values={entry.spark}
          width={560}
          height={64}
          className="mt-2 h-16 w-full"
          strokeWidth={2.5}
        />
      </div>

      {/* CTAs */}
      {isYou ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-lined px-3 py-3 font-black wide text-xs text-cream transition-colors hover:border-foam/50 hover:bg-panel2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:text-sm"
          >
            <Share2 className="h-4 w-4" aria-hidden /> SHARE CARD
          </button>
          <button
            type="button"
            onClick={() => goScreen("live")}
            className="rounded-xl border-2 border-lime bg-lime px-3 py-3 font-black wide text-xs text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime sm:text-sm"
          >
            WATCH MY RUNNER
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => setBoostOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-lime bg-lime px-4 py-3.5 font-black wide text-base text-graphite hardshadow-d transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <FlameMark className="h-5 w-5" aria-hidden /> BOOST RUNNER
          </button>
          <button
            type="button"
            onClick={() => toggleFollow(entry.runnerId)}
            aria-pressed={isFollowing}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-black wide text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
              isFollowing
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-lined text-cream hover:border-foam/50 hover:bg-panel2/60"
            )}
          >
            <Bookmark
              className={cn("h-4 w-4", isFollowing && "fill-lime")}
              aria-hidden
            />
            {isFollowing ? "FOLLOWING" : "FOLLOW"}
          </button>
        </div>
      )}

      <BoostDialog entry={entry} open={boostOpen} onOpenChange={setBoostOpen} />
    </Panel>
  );
}

/* ── recent laps · public tape ──────────────────────────────── */

function tapeRowsFromLaps(laps: Lap[]) {
  return laps
    .slice(-12)
    .reverse()
    .map((l) => ({
      lap: l.number,
      asset: l.market.asset,
      side: l.side,
      entry: l.entryPrice,
      outcome: l.outcome,
      pnl: l.pnl,
      at: l.settledAt,
    }));
}

function RecentLaps({ entry, now }: { entry: ArenaRunner; now: number }) {
  const laps = useRelay((s) => s.laps);
  const isYou = !!entry.isYou;
  const live = isLiveMode();
  const [publicLaps, setPublicLaps] = useState<Lap[] | null>(null);

  useEffect(() => {
    if (isYou || !live) {
      setPublicLaps(null);
      return;
    }
    let cancelled = false;
    setPublicLaps(null);
    void (async () => {
      try {
        const [history, proof] = await Promise.all([
          relayApi.history(entry.runnerId),
          relayApi.proof(entry.runnerId).catch(
            () => ({ proof: { orders: [], settlements: [], records: [] } as ProofBundle }),
          ),
        ]);
        if (cancelled) return;
        const mapped = lapsFromHistory(
          history.laps ?? [],
          "proof" in proof ? proof.proof : { orders: [], settlements: [], records: [] },
        );
        setPublicLaps(mapped);
      } catch {
        if (!cancelled) setPublicLaps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isYou, live, entry.runnerId]);

  const rows = isYou
    ? tapeRowsFromLaps(laps)
    : live
      ? tapeRowsFromLaps(publicLaps ?? [])
      : synthTape(entry, now);
  const emptyLiveOther = !isYou && live && (publicLaps == null || publicLaps.length === 0);

  return (
    <Panel label="RECENT LAPS · PUBLIC TAPE">
      <div className="flex items-center justify-between px-5 pt-2">
        <span className="mlabel text-foam/50">
          {isYou ? "YOUR FILLS · VERIFIED" : live ? "PUBLIC FILLS" : "DERIVED FROM PUBLIC FILLS"}
        </span>
        <span className="mlabel text-foam/50">LAST 12</span>
      </div>
      <div className="mt-1 px-3 pb-3 sm:px-4" role="list" aria-label="Recent laps">
        {emptyLiveOther ? (
          <div className="px-2 py-6 text-center">
            <span className="mlabel text-foam/60">
              {publicLaps == null ? "LOADING PUBLIC TAPE…" : "NO PUBLIC FILLS YET"}
            </span>
          </div>
        ) : (
          rows.map((r) => <TapeRowItem key={r.lap} r={r} now={now} />)
        )}
      </div>
    </Panel>
  );
}

function TapeRowItem({
  r,
  now,
}: {
  r: {
    lap: number;
    asset: "BTC" | "ETH";
    side: "UP" | "DOWN";
    entry: number;
    outcome: "WIN" | "LOSS" | "VOID" | "OPEN";
    pnl: number;
    at: number;
  };
  now: number;
}) {
  const win = r.outcome === "WIN";
  const voided = r.outcome === "VOID";
  const open = r.outcome === "OPEN";
  const pnlTone = win ? "text-lime" : voided || open ? "text-foam" : "text-ember";
  const chipTone = win
    ? "border-limedeep/60 text-lime"
    : voided || open
      ? "border-lined text-foam"
      : "border-emberdeep/60 text-ember";

  return (
    <div
      role="listitem"
      aria-label={`Lap ${r.lap}, ${r.asset} ${r.side}, entry ${cents(r.entry)}, ${r.outcome.toLowerCase()}, ${signed(r.pnl)}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-panel2/50"
    >
      <span className="data w-11 shrink-0 text-xs text-foam">#{r.lap}</span>
      <AssetIcon asset={r.asset} size={20} />
      <span className="mlabel flex w-14 shrink-0 items-center gap-1 text-cream/80">
        {r.side === "UP" ? (
          <UpMark className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <DownMark className="h-3.5 w-3.5" aria-hidden />
        )}
        {r.side}
      </span>
      <span className="data hidden w-12 text-right text-xs text-foam sm:block">
        {cents(r.entry)}
      </span>
      <span className={cn("mlabel shrink-0 rounded border px-1.5 py-0.5", chipTone)}>
        {r.outcome}
      </span>
      <motion.span
        key={r.pnl}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className={cn("data ml-auto text-sm font-semibold", pnlTone)}
      >
        {r.pnl === 0 ? money(0) : signed(r.pnl)}
      </motion.span>
      <span className="data w-16 shrink-0 text-right text-[10px] text-foam/70">
        {ago(r.at, now)}
      </span>
    </div>
  );
}

/* ── streak history ─────────────────────────────────────────── */

function StreakHistory({ entry }: { entry: ArenaRunner }) {
  const laps = useRelay((s) => s.laps);
  const isYou = !!entry.isYou;

  const ticks = isYou ? ticksFromLaps(laps, 18) : isLiveMode() ? [] : synthTicks(entry, 18);
  const longest = longestWinRange(ticks);
  const n = ticks.length;
  const wins = ticks.filter((t) => t === "W").length;
  const voids = ticks.filter((t) => t === "V").length;
  const losses = n - wins - voids;

  const bracketLeft = n > 0 ? (longest.start / n) * 100 : 0;
  const bracketWidth = n > 0 ? (longest.length / n) * 100 : 0;
  const labelLeft =
    n > 0
      ? Math.min(85, Math.max(15, ((longest.start + longest.length / 2) / n) * 100))
      : 50;

  return (
    <Panel label="STREAK HISTORY">
      <div className="px-5 pb-4 pt-3">
        <div
          role="img"
          aria-label={`Last ${n} windows: ${wins} wins, ${losses} losses, ${voids} voids. Longest win run ×${longest.length}.`}
          className="flex items-end gap-1.5"
        >
          {ticks.map((t, i) => (
            <motion.span
              key={i}
              initial={{ scaleY: 0.3, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: i * 0.012, duration: 0.18 }}
              className={cn(
                "h-7 flex-1 origin-bottom rounded-sm",
                t === "W" ? "bg-lime" : t === "L" ? "bg-ember" : "bg-foam/25"
              )}
              aria-hidden
            />
          ))}
        </div>
        <div className="track-dash mt-2.5 text-foam/20" aria-hidden />

        {longest.length >= 2 && (
          <div className="relative mt-2 h-6">
            <div
              className="absolute h-2.5 rounded-b-md border-x-2 border-b-2 border-flame/70"
              style={{ left: `${bracketLeft}%`, width: `${bracketWidth}%` }}
              aria-hidden
            />
            <span
              className="mlabel absolute -translate-x-1/2 whitespace-nowrap text-flame"
              style={{ left: `${labelLeft}%` }}
            >
              LONGEST ×{longest.length}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="mlabel text-foam/50">LAST {n} WINDOWS · OLDEST → LATEST</span>
          <span className="mlabel flex items-center gap-3 text-foam/50">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-sm bg-lime" aria-hidden /> WIN
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-sm bg-ember" aria-hidden /> LOSS
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-sm bg-foam/40" aria-hidden /> VOID
            </span>
          </span>
        </div>
      </div>
    </Panel>
  );
}

/* ── risk policy ────────────────────────────────────────────── */

function RiskPolicy({ entry }: { entry: ArenaRunner }) {
  const config = useRelay((s) => s.config);
  const streakState = useRelay((s) => s.streak);
  const isYou = !!entry.isYou;

  const rows = isYou
    ? [
        {
          icon: <Wallet className="h-4 w-4 text-foam" aria-hidden />,
          label: "BUDGET BOUNDED",
          value: `Worst case = ${money(config.stopLoss)} stop-loss · budget ${money(config.budget)}`,
        },
        {
          icon: <Gauge className="h-4 w-4 text-foam" aria-hidden />,
          label: "STAKE CAP",
          value: `Stakes capped at ${pct(config.maxStakePct, 0)} of bankroll`,
        },
        {
          icon: <ShieldMark className="h-5 w-5" aria-hidden />,
          label: "SHIELDS",
          value:
            isLiveMode() && streakState.shieldsMax === 0
              ? "Not on-chain yet — streak is verified wins only"
              : `${streakState.shields}/${streakState.shieldsMax} — one loss absorbed without breaking the streak`,
        },
        {
          icon: <Timer className="h-4 w-4 text-foam" aria-hidden />,
          label: "HEADROOM GATE",
          value: `No entry after ${pct(config.headroomGatePct, 0)} of window`,
        },
      ]
    : [
        {
          icon: <Wallet className="h-4 w-4 text-foam" aria-hidden />,
          label: "BUDGET BOUNDED",
          value: "Worst case = stop-loss",
        },
        {
          icon: <Gauge className="h-4 w-4 text-foam" aria-hidden />,
          label: "STAKE CAP",
          value: "Stakes capped at 10% of bankroll",
        },
        {
          icon: <ShieldMark className="h-5 w-5" aria-hidden />,
          label: "SHIELDS",
          value: "Not on-chain — streak is verified wins only",
        },
        {
          icon: <Timer className="h-4 w-4 text-foam" aria-hidden />,
          label: "HEADROOM GATE",
          value: "No entry after 60% of window",
        },
      ];

  return (
    <Panel label="RISK POLICY">
      <ul className="grid gap-3 px-5 pb-4 pt-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-lined bg-panel2/60">
              {r.icon}
            </span>
            <div className="min-w-0">
              <div className="mlabel text-foam/70">{r.label}</div>
              <div className="mt-1 text-sm leading-snug text-cream/90">{r.value}</div>
            </div>
          </li>
        ))}
      </ul>
      {!isYou && (
        <div className="border-t-2 border-lined px-5 py-4">
          <div className="mlabel text-foam/60">
            BOOST DEPLOYS YOUR OWN VAULT WITH THIS BIAS
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── followers row ──────────────────────────────────────────── */

function FollowersRow({ entry }: { entry: ArenaRunner }) {
  const following = useRelay((s) => s.following);
  const isFollowing = following.includes(entry.runnerId);

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <span className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-foam" aria-hidden />
          <span className="data text-lg font-semibold leading-none">{entry.followers}</span>
          <span className="mlabel text-foam/70">FOLLOWERS</span>
        </span>
        <span className="flex items-center gap-2.5">
          <FlameMark className="h-4 w-4" aria-hidden />
          <span className="data text-lg font-semibold leading-none">{entry.boosters}</span>
          <span className="mlabel text-foam/70">BOOSTERS</span>
        </span>
        {isFollowing && (
          <span className="mlabel ml-auto rounded-full border-2 border-lime/60 bg-lime/10 px-3 py-1.5 text-lime">
            YOU FOLLOW THIS RUNNER
          </span>
        )}
      </div>
    </Panel>
  );
}

/* ── bits ───────────────────────────────────────────────────── */

function StatusChip({ status }: { status: "RUNNING" | "PAUSED" }) {
  return status === "RUNNING" ? (
    <LiveDot label="RUNNING" tone="lime" />
  ) : (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-foam/60" aria-hidden />
      <span className="mlabel text-foam">PAUSED</span>
    </span>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mlabel inline-flex items-center gap-1.5 rounded-full border-2 border-lined px-2.5 py-1 text-foam",
        className
      )}
    >
      {children}
    </span>
  );
}
