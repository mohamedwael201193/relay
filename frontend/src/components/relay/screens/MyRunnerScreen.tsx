"use client";

/**
 * RELAY — MY RUNNER screen.
 * The emotional center of the broadcast world: one runner, one lap ring,
 * streak, bankroll, risk budget — legible in five seconds.
 */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Radio } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { selectLivePnl, selectNextStake, selectPnl, useRelay } from "@/lib/relay/engine/store";
import { isOpsVault } from "@/lib/relay/config/network";
import { isLiveMode } from "@/lib/relay/live/mode";
import type { Lap, LiveLap, Runner, RunnerStatus } from "@/lib/relay/types";
import {
  cents,
  contracts,
  countdown,
  duration,
  money,
  pct,
  price,
  shortHash,
  signed,
} from "@/lib/relay/format";
import { cn } from "@/lib/utils";
import { AssetIcon, FlameMark, ShieldMark } from "../identity/identity";
import { LapRing, ProbSplit } from "../core/LapRing";
import { Panel, PhaseStepper, Sparkline } from "../core/primitives";
import { useFlash, useMediaQuery } from "../app/hooks";

/* ── phase → runner narration ─────────────────────────────────── */

const NEXT_ACTION: Record<string, string> = {
  SCAN: "SCANNING NEXT WINDOW…",
  ARMED: "DECISION PREPARED — ENTERING SOON",
  ORDER: "ORDER LIVE — AWAITING CONFIRM",
  FILL: "FILLED — RIDING THE WINDOW",
  HOLD: "HOLDING TO SETTLEMENT",
  CLOSING: "WINDOW CLOSING — NO MORE ENTRIES",
  ORACLE: "ORACLE ANSWERING…",
  RESULT: "SETTLING…",
  CLAIM: "CLAIMED — 0 CLICKS",
  REARM: "PASSING THE BATON…",
};

const NO_POS_LABEL: Record<string, string> = {
  SCAN: "SCANNING THE WINDOW…",
  ARMED: "DECISION PREPARED…",
  ORDER: "ORDER BUILDING…",
  FILL: "AWAITING FILL…",
  REARM: "PASSING THE BATON…",
};

/* ── small parts ─────────────────────────────────────────────── */

function StatMini({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: ReactNode;
  tone?: "cream" | "lime" | "ember" | "foam";
}) {
  const tones = {
    cream: "text-cream",
    lime: "text-lime",
    ember: "text-ember",
    foam: "text-foam",
  } as const;
  return (
    <div className="rounded-xl border-2 border-lined bg-panel2/40 px-3.5 py-2.5">
      <div className="mlabel text-foam">{label}</div>
      <div className={cn("data mt-1 text-lg leading-none", tones[tone])}>{value}</div>
    </div>
  );
}

function StatusChip({ status }: { status: RunnerStatus }) {
  const meta: Record<RunnerStatus, { cls: string; dot: string; label: string; blink: boolean }> = {
    RUNNING: { cls: "border-lime bg-lime text-graphite", dot: "#14110a", label: "RUNNING", blink: true },
    DEPLOYING: { cls: "border-flame bg-flame text-graphite", dot: "#14110a", label: "ARMING", blink: true },
    PAUSED: { cls: "border-flame bg-flame/10 text-flame", dot: "#ffb224", label: "PAUSED", blink: false },
    PARKED: { cls: "border-ember bg-ember/10 text-ember", dot: "#f0512a", label: "PARKED", blink: false },
    STOPPED: { cls: "border-lined bg-panel2 text-foam", dot: "#b3a98f", label: "STOPPED", blink: false },
  };
  const m = meta[status];
  return (
    <span className={cn("mlabel inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5", m.cls)}>
      <span
        className={cn("size-2 rounded-full", m.blink && "blink")}
        style={{ background: m.dot }}
        aria-hidden
      />
      {m.label}
    </span>
  );
}

/* ── empty state — the field is empty ─────────────────────────── */

function EmptyTrackArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 230"
      fill="none"
      className={className}
      role="img"
      aria-label="An empty relay track with a resting baton"
    >
      {/* lane edges */}
      <line x1="16" y1="58" x2="624" y2="58" stroke="#3a3320" strokeWidth="2" />
      <line x1="16" y1="196" x2="624" y2="196" stroke="#3a3320" strokeWidth="2" />
      {/* dashed lanes */}
      <line x1="16" y1="104" x2="624" y2="104" stroke="#3a3320" strokeWidth="2" strokeDasharray="20 16" />
      <line x1="16" y1="150" x2="624" y2="150" stroke="#3a3320" strokeWidth="2" strokeDasharray="20 16" />
      {/* start / finish gates */}
      <line x1="72" y1="42" x2="72" y2="214" stroke="#b3a98f" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />
      <text x="72" y="30" textAnchor="middle" fontSize="11" fill="#b3a98f" fontFamily="var(--font-data)" letterSpacing="3">
        START
      </text>
      <line x1="568" y1="42" x2="568" y2="214" stroke="#b3a98f" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />
      <text x="568" y="30" textAnchor="middle" fontSize="11" fill="#b3a98f" fontFamily="var(--font-data)" letterSpacing="3">
        FINISH
      </text>
      {/* resting baton on the middle lane */}
      <g transform="rotate(-8 300 128)">
        <rect x="266" y="118" width="68" height="20" rx="10" fill="#1e1a10" stroke="#b3a98f" strokeWidth="2.5" />
        <circle cx="280" cy="128" r="3.6" fill="#b3a98f" />
        <circle cx="300" cy="128" r="3.6" fill="#ffb224" />
        <circle cx="320" cy="128" r="3.6" fill="#b3a98f" />
      </g>
    </svg>
  );
}

function EmptyField() {
  const goScreen = useRelay((s) => s.goScreen);
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
      <EmptyTrackArt className="w-full max-w-lg" />
      <h2 className="serif-accent mt-8 text-4xl text-cream sm:text-5xl">THE FIELD IS EMPTY</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-foam sm:text-base">
        No runner deployed. Set one loose — it takes 10 seconds.
      </p>
      <button
        type="button"
        onClick={() => goScreen("deploy")}
        className="hardshadow-d mlabel mt-8 rounded-xl border-2 border-lime bg-lime px-8 py-4 text-base text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >
        DEPLOY RUNNER
      </button>
      <div className="mlabel mt-5 text-foam/60">
        WORST CASE = YOUR STOP-LOSS · YOU CAN KILL IT ANY TIME
      </div>
    </div>
  );
}

/* ── runner header + status banners ───────────────────────────── */

function RunnerHeader({ runner }: { runner: Runner }) {
  const now = useRelay((s) => s.now);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-black wide text-3xl leading-none text-cream">{runner.name.toUpperCase()}</h1>
        <StatusChip status={runner.status} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="mlabel text-foam">{runner.strategy.toUpperCase()}</span>
        <span className="mlabel text-foam/40" aria-hidden>
          ·
        </span>
        <span className="mlabel text-foam">DEPLOYED {duration(runner.deployedAt, now)} AGO</span>
      </div>
    </div>
  );
}

function PausedBanner() {
  const resumeRunner = useRelay((s) => s.resumeRunner);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-flame bg-flame/10 px-4 py-3">
      <span className="mlabel text-flame">RUNNER PAUSED</span>
      <span className="text-sm text-cream/90">Open position settles normally, then it waits.</span>
      <button
        type="button"
        onClick={resumeRunner}
        className="mlabel ml-auto rounded-lg border-2 border-flame px-4 py-2.5 text-flame transition-colors hover:bg-flame hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
      >
        RESUME
      </button>
    </div>
  );
}

function ParkedBanner() {
  const goScreen = useRelay((s) => s.goScreen);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ember bg-ember/10 px-4 py-3">
      <span className="mlabel text-ember">PARKED AT STOP-LOSS</span>
      <span className="text-sm text-cream/90">The hard floor did its job.</span>
      <button
        type="button"
        onClick={() => goScreen("deploy")}
        className="mlabel ml-auto rounded-lg border-2 border-ember px-4 py-2.5 text-ember transition-colors hover:bg-ember hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
      >
        REDEPLOY
      </button>
    </div>
  );
}

/* ── the lap ring (dominant) ──────────────────────────────────── */

function RingArea({ status }: { status: RunnerStatus }) {
  const liveLap = useRelay((s) => s.liveLap);
  const resumeRunner = useRelay((s) => s.resumeRunner);
  const goScreen = useRelay((s) => s.goScreen);
  const restingAsset = useRelay((s) => s.config.assets[0] ?? "BTC");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const size = isDesktop ? 340 : 260;

  if (!liveLap) {
    return (
      <div className="flex flex-col items-center">
        <LapRing
          progress={1}
          countdownLabel="00:00"
          phase="SCAN"
          asset={restingAsset}
          side={null}
          size={size}
          centerLabel="WAITING"
        />
        <div className="mt-5 mlabel text-foam">RUNNER WAITING</div>
        <p className="mt-2 max-w-[28ch] text-center text-sm text-foam/80">
          No window in flight.{" "}
          {status === "PAUSED"
            ? "Resume to pass the baton to the next window."
            : "The next lap starts when the runner does."}
        </p>
        {status === "PAUSED" && (
          <button
            type="button"
            onClick={resumeRunner}
            className="mlabel mt-4 rounded-lg border-2 border-flame px-5 py-2.5 text-flame transition-colors hover:bg-flame hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
          >
            RESUME RUNNER
          </button>
        )}
        {status === "PARKED" && (
          <button
            type="button"
            onClick={() => goScreen("deploy")}
            className="mlabel mt-4 rounded-lg border-2 border-ember px-5 py-2.5 text-ember transition-colors hover:bg-ember hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
          >
            REDEPLOY RUNNER
          </button>
        )}
      </div>
    );
  }

  const progress =
    liveLap.windowTotalMs > 0 ? liveLap.windowElapsedMs / liveLap.windowTotalMs : 0;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-[420px] items-center justify-between">
        <span className="mlabel text-foam">LAP {liveLap.number}</span>
        <span className="mlabel text-foam">{liveLap.market.label.toUpperCase()}</span>
      </div>
      <div className="mt-4 flex justify-center">
        <LapRing
          progress={progress}
          countdownLabel={countdown(liveLap.countdownMs)}
          phase={liveLap.phase}
          asset={liveLap.market.asset}
          side={liveLap.position?.side ?? null}
          size={size}
          centerLabel={`${liveLap.market.asset} · ${liveLap.market.cadence.toUpperCase()}`}
        />
      </div>
      <div className="mt-5 w-full max-w-[420px]">
        <PhaseStepper phase={liveLap.phase} />
      </div>
      <div className="mt-3.5 mlabel text-center text-flame" aria-live="polite">
        {NEXT_ACTION[liveLap.phase] ?? "RIDING THE WINDOW…"}
      </div>
    </div>
  );
}

/* ── arming sequence (right after deployDraft) ────────────────── */

function ArmingPanel({ name }: { name: string }) {
  const steps = ["Vault deployed", "Budget locked", "Reactivity armed"];
  return (
    <Panel label="ARMING">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
        <div className="flex min-h-[44px] items-center gap-3">
          <Radio
            className="size-5 shrink-0 animate-[spin_2.4s_linear_infinite] text-lime"
            aria-hidden
          />
          <span className="mlabel text-cream">{name.toUpperCase()} IS TAKING THE TRACK</span>
        </div>
        {steps.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.3, duration: 0.28 }}
            className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-lined bg-panel2/50 px-4 py-3"
          >
            <Check className="size-4 shrink-0 text-lime" aria-hidden />
            <span className="text-sm text-cream">{label}</span>
            <span className="mlabel ml-auto text-lime">DONE</span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.3 }}
          className="flex min-h-[44px] items-center rounded-xl border-2 border-flame/60 bg-flame/10 px-4 py-3"
        >
          <span className="mlabel blink text-flame">SCANNING FIRST WINDOW…</span>
        </motion.div>
      </div>
    </Panel>
  );
}

/* ── controls ─────────────────────────────────────────────────── */

function ControlsRow({ name, status }: { name: string; status: RunnerStatus }) {
  const pauseRunner = useRelay((s) => s.pauseRunner);
  const resumeRunner = useRelay((s) => s.resumeRunner);
  const stopRunner = useRelay((s) => s.stopRunner);
  const opsLocked = isOpsVault(useRelay((s) => s.vaultAddress));
  const [killOpen, setKillOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {status === "RUNNING" && (
          <button
            type="button"
            onClick={pauseRunner}
            className="mlabel rounded-lg border-2 border-lined px-5 py-2.5 text-cream transition-colors hover:border-foam hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            PAUSE RUNNER
          </button>
        )}
        {status === "PAUSED" && (
          <button
            type="button"
            onClick={resumeRunner}
            className="mlabel rounded-lg border-2 border-flame px-5 py-2.5 text-flame transition-colors hover:bg-flame hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
          >
            RESUME RUNNER
          </button>
        )}
        <AlertDialog open={killOpen} onOpenChange={setKillOpen}>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={opsLocked || status === "STOPPED"}
              className="mlabel rounded-lg border-2 border-ember px-5 py-2.5 text-ember transition-colors hover:bg-ember hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:opacity-40"
            >
              KILL RUNNER
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl border-2 border-lined bg-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black wide text-xl text-cream">
                KILL {name.toUpperCase()}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foam">
                The open order self-expires and the current position settles to the oracle answer.
                Everything the runner holds stays withdrawable — it can never be moved by anyone
                but you.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mlabel rounded-xl border-2 border-lined bg-transparent text-cream hover:bg-panel2 hover:text-cream">
                KEEP IT RUNNING
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => stopRunner()}
                className="mlabel rounded-xl border-2 border-ember bg-ember text-cream hover:bg-ember/90"
              >
                KILL RUNNER
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="mlabel text-foam/60">WORST CASE BOUNDED · RUNNER CANNOT WITHDRAW</p>
    </div>
  );
}

/* ── right column panels ──────────────────────────────────────── */

function CurrentWindowPanel({ live }: { live: LiveLap | null }) {
  const liveFlash = useFlash(live?.price ?? 0);
  if (!live) {
    return (
      <Panel label="CURRENT WINDOW">
        <div className="flex min-h-[44px] flex-col items-center gap-2 px-5 pb-6 pt-4">
          <span className="mlabel text-foam">NO WINDOW IN FLIGHT</span>
          <span className="text-sm text-foam/70">The runner is waiting.</span>
        </div>
      </Panel>
    );
  }
  const market = live.market;
  return (
    <Panel label="CURRENT WINDOW">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        <div className="flex items-center gap-3">
          <AssetIcon asset={market.asset} size={30} />
          <div className="min-w-0">
            <div className="font-bold leading-tight text-cream">{market.label.toUpperCase()}</div>
            <div className="mlabel mt-1 text-foam">{market.venue.toUpperCase()}</div>
          </div>
          <span className="mlabel ml-auto shrink-0 rounded-md border-2 border-lined px-2 py-1 text-foam">
            {market.cadence.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-lined bg-panel2/40 px-3.5 py-2.5">
            <div className="mlabel text-foam">OPEN</div>
            <div className="data mt-1 text-lg leading-none text-cream">
              {price(market.openPrice, market.asset)}
            </div>
          </div>
          <div className="rounded-xl border-2 border-lined bg-panel2/40 px-3.5 py-2.5">
            <div className="mlabel text-foam">LIVE</div>
            <div
              className={cn(
                "data mt-1 text-lg leading-none transition-colors",
                liveFlash === "up"
                  ? "text-lime"
                  : liveFlash === "down"
                    ? "text-ember"
                    : "text-cream"
              )}
            >
              {price(live.price, market.asset)}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="mlabel text-lime">UP {pct(live.probUp)}</span>
            <span className="mlabel text-ember">DOWN {pct(1 - live.probUp)}</span>
          </div>
          <ProbSplit probUp={live.probUp} />
        </div>
        <div className="mlabel truncate text-foam/60">MARKET {shortHash(market.marketId)}</div>
      </div>
    </Panel>
  );
}

function PositionPanel({ live, waiting }: { live: LiveLap | null; waiting: boolean }) {
  const livePnl = selectLivePnl(live);
  const flash = useFlash(livePnl);
  const pos = live?.position ?? null;

  return (
    <Panel label="POSITION">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        {pos ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "data rounded-lg border-2 px-3 py-1.5 text-base font-semibold",
                  pos.side === "UP"
                    ? "border-lime bg-lime text-graphite"
                    : "border-ember bg-ember text-cream"
                )}
              >
                {pos.side === "UP" ? "▲ UP" : "▼ DOWN"}
              </span>
              <span className="mlabel text-foam">
                LAP {pos.lapNumber} · {contracts(pos.quantity)} CONTRACTS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatMini label="STAKE" value={money(pos.stake)} />
              <StatMini label="ENTRY" value={cents(pos.entryPrice)} />
              <StatMini label="MARK" value={cents(pos.markPrice)} />
              <StatMini label="SIZE" value={contracts(pos.quantity)} />
            </div>
            <div className="border-t-2 border-lined pt-3">
              <div className="mlabel text-foam">LIVE PNL</div>
              <div
                className={cn(
                  "data mt-1 text-3xl font-semibold leading-none transition-colors",
                  flash
                    ? flash === "up"
                      ? "text-lime"
                      : "text-ember"
                    : livePnl > 0
                      ? "text-lime"
                      : livePnl < 0
                        ? "text-ember"
                        : "text-cream"
                )}
                aria-live="off"
              >
                {signed(livePnl)}
              </div>
            </div>
          </>
        ) : waiting ? (
          <div className="flex min-h-[44px] flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-lined px-4 py-6 text-center">
            <span className="mlabel text-foam">NO OPEN POSITION</span>
            <span className="text-sm text-foam/70">The runner is waiting — nothing at risk.</span>
          </div>
        ) : (
          <div className="flex min-h-[44px] flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-lined px-4 py-6 text-center">
            <span className="mlabel blink text-flame" aria-live="polite">
              {NO_POS_LABEL[live?.phase ?? "SCAN"] ?? "PREPARING…"}
            </span>
            <div className="mt-2 grid w-full grid-cols-2 gap-2">
              <div className="h-3 animate-pulse rounded bg-panel2" />
              <div className="h-3 animate-pulse rounded bg-panel2" />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function BankrollPanel() {
  const bankroll = useRelay((s) => s.bankroll);
  const startBankroll = useRelay((s) => s.startBankroll);
  const laps = useRelay((s) => s.laps);
  const pnl = useMemo(
    () => selectPnl({ bankroll, startBankroll, laps }),
    [bankroll, startBankroll, laps]
  );
  const series = useMemo(() => {
    const vals: number[] = [startBankroll];
    let b = startBankroll;
    for (const l of laps) {
      b = +(b + l.pnl).toFixed(2);
      vals.push(b);
    }
    vals.push(bankroll);
    return vals;
  }, [startBankroll, laps, bankroll]);
  const flash = useFlash(bankroll);

  return (
    <Panel label="BANKROLL">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        <div>
          <div
            className={cn(
              "data text-4xl font-semibold leading-none transition-colors",
              flash === "up" ? "text-lime" : flash === "down" ? "text-ember" : "text-cream"
            )}
          >
            {money(bankroll)}
          </div>
          <div className="mlabel mt-2 text-foam">START {money(startBankroll)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatMini
            label="REALIZED"
            value={signed(pnl.realized)}
            tone={pnl.realized > 0 ? "lime" : pnl.realized < 0 ? "ember" : "cream"}
          />
          <StatMini
            label="TODAY"
            value={signed(pnl.today)}
            tone={pnl.today > 0 ? "lime" : pnl.today < 0 ? "ember" : "cream"}
          />
          <StatMini label="PEAK" value={money(pnl.peakBankroll)} />
          <StatMini
            label="DRAWDOWN"
            value={money(-pnl.drawdown)}
            tone={pnl.drawdown > 0 ? "ember" : "cream"}
          />
        </div>
        <div>
          <div className="mlabel mb-1.5 text-foam">EQUITY CURVE</div>
          <Sparkline values={series} width={280} height={40} className="h-10 w-full" />
        </div>
      </div>
    </Panel>
  );
}

function StreakPanel() {
  const streak = useRelay((s) => s.streak);
  const live = isLiveMode();
  const onchain = !live || streak.shieldsMax > 0;
  return (
    <Panel label="STREAK">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        <div className="flex items-center gap-3">
          <FlameMark className="h-9 w-auto" animated={streak.current > 0} />
          <span className="data text-4xl font-semibold leading-none text-cream">
            ×{streak.current}
          </span>
          <span className="mlabel ml-auto text-foam">BEST ×{streak.best}</span>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: streak.shieldsMax }, (_, i) => (
            <ShieldMark key={i} filled={i < streak.shields} className="h-6 w-auto" />
          ))}
          <span className="mlabel ml-1 text-foam/80">
            {live && !onchain
              ? "SHIELDS NOT ON-CHAIN YET"
              : `${streak.shields}/${streak.shieldsMax} HELD`}
          </span>
        </div>
        {!live && (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="mlabel text-foam">NEXT SHIELD</span>
                <span className="data text-sm text-lime">
                  {Math.round(streak.nextShield * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-lined">
                <div
                  className="h-full rounded-full bg-lime"
                  style={{
                    width: `${Math.round(streak.nextShield * 100)}%`,
                    transition: "width 400ms",
                  }}
                />
              </div>
            </div>
            <div className="mlabel text-foam">
              PROTECTED {streak.protectedCount} LOSS{streak.protectedCount === 1 ? "" : "ES"}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function RiskPanel() {
  const bankroll = useRelay((s) => s.bankroll);
  const startBankroll = useRelay((s) => s.startBankroll);
  const laps = useRelay((s) => s.laps);
  const streakCurrent = useRelay((s) => s.streak.current);
  const config = useRelay((s) => s.config);
  const pnl = useMemo(
    () => selectPnl({ bankroll, startBankroll, laps }),
    [bankroll, startBankroll, laps]
  );
  const nextStake = selectNextStake(bankroll, streakCurrent, config);
  const stopFrac =
    config.stopLoss > 0 ? Math.min(1, Math.max(0, pnl.drawdown / config.stopLoss)) : 0;
  const stopTone = stopFrac < 0.5 ? "bg-lime" : stopFrac < 0.8 ? "bg-flame" : "bg-ember";

  return (
    <Panel label="RISK BUDGET">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="mlabel text-foam">DRAWDOWN VS STOP-LOSS</span>
            <span className="data text-sm text-cream">
              {money(pnl.drawdown)} / {money(config.stopLoss)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border-2 border-lined bg-panel2">
            <div
              className={cn("h-full rounded-full transition-all duration-500", stopTone)}
              style={{ width: `${Math.round(stopFrac * 100)}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatMini label="NEXT STAKE" value={money(nextStake)} />
          <StatMini label="STAKE CAP" value={pct(config.maxStakePct, 0)} />
          <StatMini label="HEADROOM GATE" value={pct(config.headroomGatePct, 0)} />
          <StatMini label="STOP-LOSS" value={money(config.stopLoss)} tone="ember" />
        </div>
        <div className="mlabel text-foam/70">
          RUNNER PARKS ITSELF AT THE FLOOR · NO MANUAL WATCH
        </div>
      </div>
    </Panel>
  );
}

function ResultBanner() {
  const lastResult = useRelay((s) => s.lastResult);
  const resultSeen = useRelay((s) => s.resultSeen);
  const openResult = useRelay((s) => s.openResult);
  if (!lastResult || resultSeen) return null;
  const r = lastResult;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-lime bg-lime/10 px-4 py-3 sm:col-span-2">
      <FlameMark className="h-4 w-auto" animated />
      <span className="data text-cream">
        {r.outcome === "VOID"
          ? `LAP ${r.lap} VOIDED — STAKE RETURNED`
          : `LAP ${r.lap} SETTLED — ${signed(r.pnl)}`}
      </span>
      <span className="mlabel text-flame">STREAK ×{r.streakAfter}</span>
      <button
        type="button"
        onClick={openResult}
        className="hardshadow-sm mlabel ml-auto rounded-lg border-2 border-lime bg-lime px-4 py-2 text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >
        VIEW RESULT
      </button>
    </div>
  );
}

/* ── recent laps strip ────────────────────────────────────────── */

function LapTick({ lap, onClick }: { lap: Lap; onClick: () => void }) {
  const tone =
    lap.outcome === "WIN"
      ? "bg-lime text-graphite"
      : lap.outcome === "LOSS"
        ? "bg-ember text-cream"
        : "bg-panel2 text-foam";
  const mark = lap.outcome === "WIN" ? "✓" : lap.outcome === "LOSS" ? "✕" : "–";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Lap ${lap.number} ${lap.outcome.toLowerCase()}, ${signed(lap.pnl)}, streak ×${lap.streakAfter}`}
          className={cn(
            "data relative grid size-8 place-items-center rounded-lg border-2 border-transparent text-sm font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-lime",
            tone
          )}
        >
          {mark}
          {lap.shielded && (
            <>
              <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-flame" aria-hidden />
              <span className="absolute -right-1.5 -top-1.5">
                <ShieldMark className="h-3.5 w-auto" filled />
              </span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="rounded-lg border-2 border-lined bg-panel2 px-3 py-2 text-left"
      >
        <div className="mlabel text-foam">
          {lap.market.label.toUpperCase()} · LAP {lap.number}
        </div>
        <div className="data mt-1 text-xs text-cream">
          {lap.side} · ENTRY {cents(lap.entryPrice)} · STAKE {money(lap.stake)}
        </div>
        <div
          className={cn(
            "data text-xs font-semibold",
            lap.pnl > 0 ? "text-lime" : lap.pnl < 0 ? "text-ember" : "text-foam"
          )}
        >
          {lap.outcome} {signed(lap.pnl)}
        </div>
        <div className="mlabel mt-0.5 text-flame">STREAK ×{lap.streakAfter}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function RecentLaps() {
  const laps = useRelay((s) => s.laps);
  const goScreen = useRelay((s) => s.goScreen);
  const recent = laps.slice(-10);
  const wins = laps.filter((l) => l.outcome === "WIN").length;
  const losses = laps.filter((l) => l.outcome === "LOSS").length;
  const decided = wins + losses;
  const rate = decided > 0 ? wins / decided : 0;

  return (
    <Panel label="RECENT LAPS" className="sm:col-span-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 pb-5 pt-3">
        {laps.length === 0 ? (
          <p className="serif-accent py-2 text-lg text-foam">
            First lap running now — the tape starts here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {recent.map((l) => (
                <LapTick key={l.number} lap={l} onClick={() => goScreen("history")} />
              ))}
            </div>
            <div className="ml-auto shrink-0 text-right">
              <span className="data text-sm text-cream">
                {laps.length} LAPS · {decided > 0 ? pct(rate, 1) : "—"} WIN
              </span>
              <div className="mlabel mt-1 text-foam/60">
                {wins}W · {losses}L
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ── screen ───────────────────────────────────────────────────── */

export function MyRunnerScreen() {
  const runner = useRelay((s) => s.runner);
  const liveLap = useRelay((s) => s.liveLap);

  if (!runner || runner.status === "STOPPED") {
    return <EmptyField />;
  }
  const status = runner.status;

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(340px,420px)_1fr] lg:items-start">
      {/* left column — the runner */}
      <div className="flex flex-col gap-5">
        <RunnerHeader runner={runner} />
        {status === "PAUSED" && <PausedBanner />}
        {status === "PARKED" && <ParkedBanner />}
        {status === "DEPLOYING" ? (
          <ArmingPanel name={runner.name} />
        ) : (
          <RingArea status={status} />
        )}
        {status !== "DEPLOYING" && <ControlsRow name={runner.name} status={status} />}
      </div>

      {/* right column — the numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CurrentWindowPanel live={liveLap} />
        <PositionPanel live={liveLap} waiting={!liveLap} />
        <BankrollPanel />
        <StreakPanel />
        <RiskPanel />
        <ResultBanner />
        <RecentLaps />
      </div>
    </div>
  );
}
