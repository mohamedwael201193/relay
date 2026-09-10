"use client";

/**
 * RELAY landing — the story sections.
 * 1 The problem (markets never sleep) → 2 The mental model (one window = one
 * lap) → 3 How it works → 4 The autonomous loop → 5 Streaks & shields →
 * 6 Safety → 7 The arena teaser → 8 Proof → final CTA.
 * All live numbers derive from the store; static copy is marketing voice.
 */

import { Fragment, type ReactNode } from "react";
import { Activity, ArrowRight, Gauge, Lock, Power, Rocket, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelay, selectNextStake } from "@/lib/relay/engine/store";
import { money, signed } from "@/lib/relay/format";
import type { ArenaRunner } from "@/lib/relay/types";
import { BatonGlyph, RunnerGlyph } from "../identity/identity";
import { LiveDot } from "../core/primitives";
import { ctaInk, ctaLink, ctaPrimary, Reveal, SectionHead } from "./ui";
import {
  BatonPassDiagram,
  LoopDiagram,
  ProofReceipt,
  StreakComposition,
  VaultReceipt,
  WallOfWindows,
} from "./stickers";

const INK = "#1a1610";

/* ── section shell ──────────────────────────────────────────── */

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-20", className)}>
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-32">{children}</div>
    </section>
  );
}

/* ── SECTION 1 — the problem ────────────────────────────────── */

export function ProblemSection() {
  return (
    <Section>
      <div className="grid items-start gap-12 lg:grid-cols-[0.9fr,1.1fr] lg:gap-16">
        <div>
          <SectionHead
            kicker="THE OLD WAY"
            title={
              <>
                Markets never sleep. <span className="serif-accent font-normal">You do.</span>
              </>
            }
          />
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink2">
              DreamDEX mints a fresh Up/Down window every 5 to 60 minutes — 96 a day at 15-minute
              cadence. Every one of them settles on-chain. And the old flow makes you babysit each
              one: pick, size, confirm, wait, claim, repeat.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.16}>
          <WallOfWindows />
          <div className="mt-12 mlabel text-center text-ink3">PICK · SIZE · CONFIRM · WAIT · CLAIM · REPEAT</div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── SECTION 2 — the mental model ───────────────────────────── */

function MicroStats() {
  const items = ["5M · 15M · 1H ROLLING WINDOWS", "ZERO FEES", "SETTLES ON-CHAIN"];
  return (
    <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
      {items.map((t, i) => (
        <Fragment key={t}>
          {i > 0 && <span className="hidden h-0.5 w-10 track-dash text-ink3 sm:block" aria-hidden />}
          <span className="data text-xs font-semibold tracking-[0.08em] text-ink2">{t}</span>
        </Fragment>
      ))}
    </div>
  );
}

export function MentalModelSection() {
  return (
    <Section className="border-y border-linen bg-paper2/60">
      <SectionHead
        center
        kicker="THE MENTAL MODEL"
        title={
          <>
            One window <span className="serif-accent font-normal">= one lap.</span>
          </>
        }
      />
      <Reveal delay={0.1}>
        <BatonPassDiagram />
      </Reveal>
      <Reveal delay={0.18}>
        <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed text-ink2">
          Your runner passes the baton from window to window. Every lap is a real fill, a real
          settlement, a real streak tick.
        </p>
      </Reveal>
      <Reveal delay={0.24}>
        <MicroStats />
      </Reveal>
    </Section>
  );
}

/* ── SECTION 3 — how it works ───────────────────────────────── */

function OracleWaveMini() {
  return (
    <svg viewBox="0 0 64 32" className="h-7 w-auto" aria-hidden>
      <circle cx="10" cy="16" r="4" fill={INK} />
      <path d="M10 8 A 8 8 0 0 0 10 24" fill="none" stroke={INK} strokeWidth="2" opacity="0.55" className="blink" />
      <path
        d="M10 2 A 14 14 0 0 0 10 30"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        opacity="0.3"
        className="blink"
        style={{ animationDelay: "0.4s" }}
      />
      <path d="M26 22 h 30" stroke={INK} strokeWidth="2" opacity="0.35" strokeDasharray="6 5" />
    </svg>
  );
}

const HOW_STEPS = [
  {
    n: "01",
    icon: Rocket,
    title: "DEPLOY IN 10 SECONDS",
    body: "Pick a bias, a budget, a stop-loss. The runner lives in your own vault.",
    motif: <BatonGlyph glow className="h-auto w-14" />,
  },
  {
    n: "02",
    icon: Activity,
    title: "IT RUNS EVERY WINDOW",
    body: "Scans, sizes with the streak, posts orders, gets filled same-block.",
    motif: <div className="h-0.5 w-full track-dash dashflow text-ink3" />,
  },
  {
    n: "03",
    icon: Zap,
    title: "SETTLEMENT RUNS ITSELF",
    body: "Oracle answers, winnings are claimed, next lap arms — via Somnia Reactivity. Zero buttons.",
    motif: <OracleWaveMini />,
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works">
      <SectionHead kicker="HOW IT WORKS" title="Three moves. Then it runs." />
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {HOW_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reveal key={step.n} delay={i * 0.08} className="h-full">
              <div
                className={cn(
                  "sticker h-full p-6 transition-transform duration-200 hover:rotate-0 sm:p-7",
                  i === 1 ? "rotate-[1deg]" : "rotate-[-1deg]"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="data text-sm font-bold text-ink2">{step.n}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-lime hardshadow-sm">
                    <Icon className="h-6 w-6 text-ink" strokeWidth={2.2} aria-hidden />
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-extrabold wide tracking-tight">{step.title}</h3>
                <p className="mt-2.5 leading-relaxed text-ink2">{step.body}</p>
                <div className="mt-7 flex h-7 items-center">{step.motif}</div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/* ── SECTION 4 — the loop (broadcast inset) ─────────────────── */

export function LoopSection() {
  return (
    <Section>
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-graphite px-6 py-10 text-cream hardshadow sm:px-12 sm:py-14">
          <div className="absolute right-5 top-5">
            <LiveDot tone="lime" label="SOMNIA REACTIVITY" />
          </div>
          <div className="mlabel text-lime">THE LOOP</div>
          <h2 className="mt-4 max-w-3xl text-[clamp(1.9rem,4.2vw,3.4rem)] font-black wide leading-[0.98]">
            The part you’d click?{" "}
            <span className="serif-accent font-normal text-lime">It doesn’t exist.</span>
          </h2>
          <p className="mt-5 max-w-xl leading-relaxed text-foam">
            On Somnia, the oracle’s answer is delivered to your runner’s vault in the same flow.
            Claim, streak, re-arm — zero manual calls.
          </p>
          <LoopDiagram />
          <p className="data text-sm text-foam/90">
            manualResolutionCalls: <span className="font-semibold text-lime">0</span>
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

/* ── SECTION 5 — streaks & shields ──────────────────────────── */

export function StreaksSection() {
  const streak = useRelay((s) => s.streak);
  const bankroll = useRelay((s) => s.bankroll);
  const config = useRelay((s) => s.config);
  const nextStake = selectNextStake(bankroll, streak.current, config);

  const blocks = [
    {
      head: "STREAKS COMPOUND",
      body: "Every win scales the next stake — the runner risks more while it’s hot, and resets to base after a miss.",
      chip: (
        <>
          NEXT STAKE <span className="text-limedeep">{money(nextStake)}</span>
        </>
      ),
    },
    {
      head: "SHIELDS EAT LOSSES",
      body: "A shield absorbs a loss whole. Wins refill them automatically — you never top them up by hand.",
      chip: (
        <>
          SHIELDS <span className="text-limedeep">×{streak.shields}/{streak.shieldsMax}</span>
        </>
      ),
    },
    {
      head: "A REFUND IS NOT A LOSS",
      body: "When a window voids, your stake comes back and the streak stands.",
      chip: (
        <>
          VOID = <span className="text-limedeep">STREAK KEPT</span>
        </>
      ),
    },
  ];

  return (
    <Section>
      <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHead
            kicker="STREAKS & SHIELDS"
            title={
              <>
                Your streak is <span className="serif-accent font-normal">real money.</span>
              </>
            }
          />
          <div className="mt-9 space-y-8">
            {blocks.map((b, i) => (
              <Reveal key={b.head} delay={i * 0.08}>
                <div className="mlabel text-flamedeep">{b.head}</div>
                <p className="mt-2 max-w-md leading-relaxed text-ink2">{b.body}</p>
                <div className="sticker hardshadow-sm mt-3 inline-flex -rotate-1 items-center gap-2 px-3 py-1.5">
                  <span className="data text-sm font-semibold">{b.chip}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.16} className="lg:mt-14">
          <StreakComposition />
        </Reveal>
      </div>
    </Section>
  );
}

/* ── SECTION 6 — safety ─────────────────────────────────────── */

const SAFETY_ROWS = [
  { icon: Gauge, lead: "Bounded by construction", rest: " — worst case is your stop-loss, on-chain." },
  { icon: Lock, lead: "The runner can trade.", rest: " It can never withdraw." },
  { icon: Power, lead: "Kill it any time", rest: " — orders self-expire, funds stay yours." },
];

export function SafetySection() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr,0.9fr] lg:gap-16">
        <div>
          <SectionHead
            kicker="SAFETY"
            title={
              <>
                You hold <span className="serif-accent font-normal">the keys.</span>
              </>
            }
          />
          <div className="mt-8 divide-y divide-linen border-y border-linen">
            {SAFETY_ROWS.map((r, i) => {
              const Icon = r.icon;
              return (
                <Reveal key={r.lead} delay={i * 0.08}>
                  <div className="flex items-start gap-5 py-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-cardp hardshadow-sm">
                      <Icon className="h-5 w-5 text-ink" strokeWidth={2.2} aria-hidden />
                    </span>
                    <p className="text-lg leading-snug sm:text-xl">
                      <strong className="font-extrabold">{r.lead}</strong>
                      <span className="text-ink2">{r.rest}</span>
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={0.24}>
            <p className="mt-5 mlabel text-ink3">TESTNET DEMO · NOT FINANCIAL ADVICE</p>
          </Reveal>
        </div>
        <Reveal delay={0.12}>
          <VaultReceipt className="mx-auto h-auto w-full max-w-[340px]" />
          <div className="mt-4 text-center mlabel text-ink3">YOUR VAULT · YOUR KEYS</div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── SECTION 7 — the arena teaser ───────────────────────────── */

function ArenaLane({ r }: { r: ArenaRunner }) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-xl border-2 px-4 py-3 sm:px-5",
        r.isYou ? "border-ink bg-linen2 hardshadow-sm" : "border-linen bg-cardp"
      )}
    >
      <span className="data w-8 shrink-0 text-lg font-bold text-ink2">#{r.rank}</span>
      <RunnerGlyph hue={r.glyph.hue} shape={r.glyph.shape} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-extrabold">{r.name}</span>
          {r.isYou && (
            <span className="mlabel shrink-0 rounded-sm border border-ink bg-lime px-1.5 py-0.5 text-graphite">YOU</span>
          )}
        </div>
        <div className="mlabel mt-0.5 truncate text-ink2">
          {r.ownerHandle} · {r.strategy}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("data text-sm font-semibold", r.pnl7d >= 0 ? "text-limedeep" : "text-emberdeep")}>
          {signed(r.pnl7d)}
        </div>
        <div className="mlabel mt-0.5 text-ink2">×{r.streak} STREAK</div>
      </div>
      <div className="absolute inset-x-4 bottom-1.5 h-px track-dash text-ink3 opacity-40" aria-hidden />
    </div>
  );
}

export function ArenaSection() {
  const go = useRelay((s) => s.go);
  const arena = useRelay((s) => s.arena);
  const you = arena.find((a) => a.isYou);
  const rows = arena.slice(0, 3);
  if (you && !rows.some((r) => r.isYou)) rows.push(you);

  return (
    <Section id="arena" className="border-y border-linen bg-paper2/60">
      <SectionHead
        kicker="THE ARENA"
        title={
          <>
            Every streak is public.{" "}
            <span className="serif-accent font-normal">Every number is verified.</span>
          </>
        }
      />
      <div className="mt-10 space-y-3">
        {rows.map((r, i) => (
          <Reveal key={r.runnerId} delay={i * 0.08}>
            <ArenaLane r={r} />
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.3}>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <button type="button" className={ctaInk} onClick={() => go("app", "arena")}>
            OPEN THE ARENA
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
          <span className="mlabel text-ink2">{arena.length} RUNNERS RACING · FOLLOW · BOOST</span>
        </div>
      </Reveal>
    </Section>
  );
}

/* ── SECTION 8 — proof ──────────────────────────────────────── */

export function ProofSection() {
  const go = useRelay((s) => s.go);
  return (
    <Section id="proof">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,540px),1fr] lg:gap-16">
        <Reveal>
          <ProofReceipt />
        </Reveal>
        <div>
          <SectionHead
            kicker="PROOF"
            title={
              <>
                Receipts, <span className="serif-accent font-normal">not dashboards.</span>
              </>
            }
          />
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink2">
              Every number RELAY shows you is derived from real fills and oracle answers. Don’t
              trust the dashboard — read the tape.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <button type="button" className={cn(ctaLink, "mt-7")} onClick={() => go("app", "history")}>
              READ THE TAPE
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ── FINAL CTA ──────────────────────────────────────────────── */

export function FinalCtaSection() {
  const go = useRelay((s) => s.go);
  const startBankroll = useRelay((s) => s.startBankroll);
  return (
    <section className="border-t-2 border-ink bg-paper2">
      <div className="mx-auto max-w-[1200px] px-5 py-20 text-center sm:px-8 sm:py-28 lg:px-12">
        <Reveal>
          <div className="mlabel text-ink2">ONE WINDOW = ONE LAP · YOUR MOVE</div>
          <h2 className="mt-5 text-[clamp(2.6rem,7vw,5.4rem)] font-black wide leading-[0.95] tracking-[-0.01em]">
            DEPLOY YOUR RUNNER.
          </h2>
          <div className="mt-9 flex justify-center">
            <button type="button" className={ctaPrimary} onClick={() => go("app", "deploy")}>
              START YOUR RUNNER
            </button>
          </div>
          <p className="mt-6 mlabel text-ink2">
            SHANNON TESTNET · {money(startBankroll)} BUDGET · CONNECT A WALLET TO START
          </p>
        </Reveal>
      </div>
    </section>
  );
}
