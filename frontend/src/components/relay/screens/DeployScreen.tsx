"use client";

/**
 * RELAY — DEPLOY screen.
 * Three decisions, a bounded worst case, one button. Near-frictionless:
 * bias → budget → stop-loss, advanced behind one collapsible, and a
 * sticky summary rail that shows exactly what can go wrong.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Lock, Pause, Radio, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useRelay } from "@/lib/relay/engine/store";
import type { AssetId, Runner, RunnerConfig, WindowCadence } from "@/lib/relay/types";
import { duration, money } from "@/lib/relay/format";
import { cn } from "@/lib/utils";
import { AssetIcon, BatonGlyph, DownMark, ShieldMark, UpMark } from "../identity/identity";
import { Panel } from "../core/primitives";

/* ── constants ────────────────────────────────────────────────── */

const BUDGETS = [25, 50, 100];
const STOP_LOSSES = [10, 20, 30];
const CADENCES: WindowCadence[] = ["5m", "15m", "1h"];
const SHIELDS = [1, 2, 3];
const LAPS_PER_DAY: Record<WindowCadence, number> = {
  "1m": 1440,
  "5m": 288,
  "15m": 96,
  "1h": 24,
};

/* ── choice tile (WAI-ARIA radio pattern) ─────────────────────── */

function ChoiceTile({
  selected,
  onSelect,
  ariaLabel,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const group = e.currentTarget.closest('[role="radiogroup"]');
    if (!group) return;
    const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const i = radios.indexOf(e.currentTarget);
    if (i < 0) return;
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = radios[(i + dir + radios.length) % radios.length];
    next.focus();
    next.click();
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex min-h-[44px] flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:scale-[0.99]",
        selected ? "border-lime bg-lime/15" : "border-lined bg-panel hover:border-foam/70"
      )}
    >
      {selected && (
        <span
          className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full border-2 border-lime bg-lime text-graphite"
          aria-hidden
        >
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      )}
      {children}
    </button>
  );
}

function GroupLegend({ index, title, hint }: { index: string; title: string; hint: string }) {
  return (
    <legend className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
      <span className="mlabel text-cream">
        {index} · {title}
      </span>
      <span className="text-xs text-foam">{hint}</span>
    </legend>
  );
}

/* ── advanced section ─────────────────────────────────────────── */

function AdvancedSection({
  draft,
  setDraft,
}: {
  draft: RunnerConfig;
  setDraft: (patch: Partial<RunnerConfig>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-lined bg-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-lime"
      >
        <span className="mlabel text-cream">ADVANCED</span>
        <span className="mlabel text-foam/60">CADENCE · ASSETS · STAKING · SHIELDS</span>
        <ChevronDown
          className={cn("ml-auto size-4 shrink-0 text-foam transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="grid gap-6 border-t-2 border-lined px-5 py-5">
          {/* cadence */}
          <fieldset>
            <legend className="mb-2.5 mlabel text-foam">CADENCE</legend>
            <div role="radiogroup" aria-label="Window cadence" className="grid grid-cols-3 gap-3">
              {CADENCES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={draft.cadence === c}
                  onClick={() => setDraft({ cadence: c })}
                  className={cn(
                    "mlabel min-h-[44px] rounded-xl border-2 px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                    draft.cadence === c
                      ? "border-lime bg-lime text-graphite"
                      : "border-lined text-foam hover:border-foam/70"
                  )}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>

          {/* assets */}
          <fieldset>
            <legend className="mb-2.5 mlabel text-foam">ASSETS</legend>
            <div className="grid grid-cols-2 gap-3">
              {(["BTC", "ETH"] as AssetId[]).map((a) => {
                const on = draft.assets.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? draft.assets.filter((x) => x !== a)
                        : [...draft.assets, a];
                      if (next.length === 0) return; // always trade at least one book
                      setDraft({ assets: next });
                    }}
                    className={cn(
                      "mlabel flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                      on
                        ? "border-lime bg-lime/15 text-lime"
                        : "border-lined text-foam hover:border-foam/70"
                    )}
                  >
                    <AssetIcon asset={a} size={18} />
                    {a}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* streak multiplier */}
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <span className="mlabel text-foam">STREAK MULTIPLIER</span>
              <span className="data text-sm text-lime">
                +{Math.round(draft.streakMultiplier * 100)}% PER STREAK
              </span>
            </div>
            <Slider
              value={[Math.round(draft.streakMultiplier * 100)]}
              min={0}
              max={20}
              step={1}
              onValueChange={(v) => setDraft({ streakMultiplier: (v[0] ?? 0) / 100 })}
              aria-label="Streak multiplier, percent per streak step"
              className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-lined [&_[data-slot=slider-range]]:bg-lime [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-graphite [&_[data-slot=slider-thumb]]:bg-lime"
            />
            <div className="mlabel mt-2 text-foam/60">
              STAKE STEPS UP AS THE STREAK GROWS · sₙ = BASE × (1 + λ·N)
            </div>
          </div>

          {/* max stake cap */}
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <span className="mlabel text-foam">MAX STAKE CAP</span>
              <span className="data text-sm text-lime">
                {Math.round(draft.maxStakePct * 100)}% OF BANKROLL
              </span>
            </div>
            <Slider
              value={[Math.round(draft.maxStakePct * 100)]}
              min={5}
              max={15}
              step={1}
              onValueChange={(v) => setDraft({ maxStakePct: (v[0] ?? 0) / 100 })}
              aria-label="Maximum stake cap, percent of bankroll"
              className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-lined [&_[data-slot=slider-range]]:bg-lime [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-graphite [&_[data-slot=slider-thumb]]:bg-lime"
            />
            <div className="mlabel mt-2 text-foam/60">CEILING FOR COMPOUNDED STAKES</div>
          </div>

          {/* shields */}
          <fieldset>
            <legend className="mb-2.5 mlabel text-foam">STREAK SHIELDS</legend>
            <div role="radiogroup" aria-label="Streak shields" className="grid grid-cols-3 gap-3">
              {SHIELDS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={draft.shieldsMax === n}
                  onClick={() => setDraft({ shieldsMax: n })}
                  className={cn(
                    "mlabel flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                    draft.shieldsMax === n
                      ? "border-lime bg-lime text-graphite"
                      : "border-lined text-foam hover:border-foam/70"
                  )}
                >
                  <ShieldMark className="h-4 w-auto" filled={draft.shieldsMax === n} />
                  {n} {n === 1 ? "SHIELD" : "SHIELDS"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

/* ── summary rail ─────────────────────────────────────────────── */

function SafetyRow({ Icon, text }: { Icon: LucideIcon; text: string }) {
  return (
    <div className="flex min-h-[32px] items-center gap-3">
      <Icon className="size-4 shrink-0 text-lime" aria-hidden />
      <span className="text-xs text-cream/90">{text}</span>
    </div>
  );
}

function SummaryPanel({
  draft,
  onStart,
  igniting,
}: {
  draft: RunnerConfig;
  onStart: () => void;
  igniting: boolean;
}) {
  return (
    <Panel label="DEPLOYMENT SUMMARY">
      <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
        <div>
          <div className="mlabel text-foam">WORST CASE</div>
          <div className="data mt-1.5 text-4xl font-semibold leading-none text-ember">
            {money(-draft.stopLoss)}
          </div>
          <div className="text-xs text-foam/80 mt-1.5">the stop-loss — nothing beyond it</div>
        </div>
        <div className="grid gap-2 border-t-2 border-lined pt-4">
          <SafetyRow Icon={Lock} text="Runner cannot withdraw" />
          <SafetyRow Icon={Pause} text="Pause or kill any time" />
          <SafetyRow
            Icon={Scale}
            text={`Stakes capped at ${Math.round(draft.maxStakePct * 100)}% of bankroll`}
          />
        </div>
        <div className="mlabel border-t-2 border-lined pt-4 text-foam">
          ≈ {LAPS_PER_DAY[draft.cadence]} LAPS/DAY AT {draft.cadence.toUpperCase()}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={igniting}
          className="hardshadow-d mlabel w-full rounded-xl border-2 border-lime bg-lime py-4 text-base text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          START RUNNER
        </button>
        <p className="mlabel text-center text-foam/60">SHANNON TESTNET · REAL tUSDC</p>
      </div>
    </Panel>
  );
}

/* ── already-on-the-track notice ──────────────────────────────── */

function ActiveNotice({
  runner,
  onWatch,
  onConfigure,
}: {
  runner: Runner;
  onWatch: () => void;
  onConfigure: () => void;
}) {
  const now = useRelay((s) => s.now);
  return (
    <Panel>
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="mlabel text-flame">ALREADY ON THE TRACK</div>
          <h1 className="mt-2 font-black wide text-3xl leading-tight text-cream">
            {runner.name} is already on the track.
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mlabel text-lime">{runner.status}</span>
            <span className="mlabel text-foam">
              DEPLOYED {duration(runner.deployedAt, now)} AGO
            </span>
            <span className="mlabel text-foam/60">{runner.strategy.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:ml-auto sm:items-end">
          <button
            type="button"
            onClick={onWatch}
            className="hardshadow-d mlabel rounded-xl border-2 border-lime bg-lime px-5 py-3.5 text-base text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            WATCH THE LIVE LAP
          </button>
          <button
            type="button"
            onClick={onConfigure}
            className="mlabel rounded-xl border-2 border-lined px-5 py-3.5 text-cream transition-colors hover:border-foam hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            CONFIGURE A NEW RUNNER
          </button>
        </div>
      </div>
    </Panel>
  );
}

/* ── screen ───────────────────────────────────────────────────── */

export function DeployScreen() {
  const runner = useRelay((s) => s.runner);
  const draft = useRelay((s) => s.draftConfig);
  const setDraft = useRelay((s) => s.setDraftConfig);
  const deployDraftAsync = useRelay((s) => s.deployDraftAsync);
  const txPhase = useRelay((s) => s.txPhase);
  const goScreen = useRelay((s) => s.goScreen);

  const active =
    runner != null && ["RUNNING", "PAUSED", "PARKED", "DEPLOYING"].includes(runner.status);
  const [configure, setConfigure] = useState(false);
  const [igniting, setIgniting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const start = () => {
    if (igniting) return;
    setIgniting(true);
    void deployDraftAsync().finally(() => {
      setIgniting(false);
      if (timer.current) window.clearTimeout(timer.current);
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-10">
      {active && !configure ? (
        <div className="py-6 lg:py-10">
          <ActiveNotice
            runner={runner}
            onWatch={() => goScreen("live")}
            onConfigure={() => setConfigure(true)}
          />
        </div>
      ) : (
        <>
          <header className="pt-6 lg:pt-10">
            <div className="mlabel text-foam">DEPLOY</div>
            <h1 className="mt-2 font-black wide text-4xl text-cream">Set your runner loose.</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-foam sm:text-base">
              Three decisions. The runner takes it from there.
            </p>
          </header>

          {runner != null && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border-2 border-flame bg-flame/10 px-4 py-3">
              <span className="mlabel text-flame">
                REDEPLOY CREATES A NEW VAULT. THE PREVIOUS RUNNER STAYS STOPPED.
              </span>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
            {/* the form */}
            <div className="flex flex-col gap-7">
              <fieldset>
                <GroupLegend index="01" title="BIAS" hint="which way it leans" />
                <div role="radiogroup" aria-label="Runner bias" className="grid grid-cols-3 gap-3">
                  <ChoiceTile
                    selected={draft.bias === "UP"}
                    onSelect={() => setDraft({ bias: "UP" })}
                    ariaLabel="Bias up — ride the up-windows"
                  >
                    <UpMark className="h-6 w-auto" />
                    <span className="text-sm font-bold text-cream">Ride the up-windows</span>
                    <span className="mlabel text-foam/70">BIAS · UP</span>
                  </ChoiceTile>
                  <ChoiceTile
                    selected={draft.bias === "DOWN"}
                    onSelect={() => setDraft({ bias: "DOWN" })}
                    ariaLabel="Bias down — fade every window"
                  >
                    <DownMark className="h-6 w-auto" />
                    <span className="text-sm font-bold text-cream">Fade every window</span>
                    <span className="mlabel text-foam/70">BIAS · DOWN</span>
                  </ChoiceTile>
                  <ChoiceTile
                    selected={draft.bias === "FOLLOW"}
                    onSelect={() => setDraft({ bias: "FOLLOW" })}
                    ariaLabel="Follow the book — reads the order flow"
                  >
                    <BatonGlyph className="h-5 w-auto" />
                    <span className="text-sm font-bold text-cream">Follow the book</span>
                    <span className="mlabel text-foam/70">READS THE ORDER FLOW</span>
                  </ChoiceTile>
                </div>
              </fieldset>

              <fieldset>
                <GroupLegend index="02" title="BUDGET" hint="what it trades with" />
                <div role="radiogroup" aria-label="Deployment budget" className="grid grid-cols-3 gap-3">
                  {BUDGETS.map((b) => (
                    <ChoiceTile
                      key={b}
                      selected={draft.budget === b}
                      onSelect={() => setDraft({ budget: b })}
                      ariaLabel={`Budget ${money(b)}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <AssetIcon asset="tUSDC" size={24} />
                        <span className="data text-2xl font-semibold text-cream">{money(b)}</span>
                      </span>
                    </ChoiceTile>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-foam/80">
                  locked in your vault — the runner trades it, never moves it
                </p>
              </fieldset>

              <fieldset>
                <GroupLegend index="03" title="STOP-LOSS" hint="the hard floor" />
                <div role="radiogroup" aria-label="Stop-loss" className="grid grid-cols-3 gap-3">
                  {STOP_LOSSES.map((sl) => (
                    <ChoiceTile
                      key={sl}
                      selected={draft.stopLoss === sl}
                      onSelect={() => setDraft({ stopLoss: sl })}
                      ariaLabel={`Stop-loss ${money(sl)}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldMark className="h-5 w-auto" filled={draft.stopLoss === sl} />
                        <span className="data text-2xl font-semibold text-cream">{money(sl)}</span>
                      </span>
                    </ChoiceTile>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-foam/80">
                  the hard floor — runner parks itself
                </p>
              </fieldset>

              <AdvancedSection draft={draft} setDraft={setDraft} />
            </div>

            {/* sticky summary rail (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <SummaryPanel draft={draft} onStart={start} igniting={igniting} />
              </div>
            </aside>
          </div>
        </>
      )}

      {/* mobile: fixed summary bar above the tab deck */}
      <div
        className="fixed inset-x-3 z-40 lg:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3 rounded-2xl border-2 border-lined bg-panel/95 px-3.5 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="mlabel text-foam">WORST CASE</div>
            <div className="data mt-1 text-lg leading-none text-ember">
              {money(-draft.stopLoss)}
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={igniting}
            className="hardshadow-d mlabel ml-auto rounded-xl border-2 border-lime bg-lime px-6 py-3.5 text-base text-graphite disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-lime"
          >
            START RUNNER
          </button>
        </div>
      </div>

      {/* ignition micro-overlay */}
      {igniting && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-graphite/90 backdrop-blur-sm"
          role="alert"
          aria-live="assertive"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hardshadow-d w-full max-w-xs rounded-2xl border-2 border-lime bg-panel px-6 py-7"
          >
            <div className="flex flex-col items-center text-center">
              {txPhase?.status === "failed" ? null : (
                <Radio
                  className="size-6 animate-[spin_2s_linear_infinite] text-lime"
                  aria-hidden
                />
              )}
              <div className="mlabel mt-4 text-cream">
                {txPhase?.label ?? "DEPLOYING VAULT → FUNDING → ARMING…"}
              </div>
              {txPhase?.status === "failed" ? (
                <button
                  type="button"
                  className="mlabel mt-5 rounded-xl border-2 border-lined px-5 py-3 text-cream hover:border-foam"
                  onClick={() => setIgniting(false)}
                >
                  CLOSE
                </button>
              ) : (
                <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-lined">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.15, ease: "linear" }}
                    className="h-full bg-lime"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
