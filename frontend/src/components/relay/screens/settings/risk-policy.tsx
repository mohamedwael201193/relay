"use client";

/**
 * RELAY — settings · RISK POLICY.
 * Two honest halves: the live policy the runner is actually running
 * (read-only — it cannot change mid-run), and the draft the next deploy
 * will use. Editing here feeds the same draft the Deploy screen consumes.
 */

import { Slider } from "@/components/ui/slider";

import { useRelay } from "@/lib/relay/engine/store";
import type { AssetId, RunnerConfig, WindowCadence } from "@/lib/relay/types";
import { money } from "@/lib/relay/format";
import { isLiveMode } from "@/lib/relay/live/mode";
import { cn } from "@/lib/utils";
import { AssetIcon, DownMark, ShieldMark, UpMark } from "../../identity/identity";
import { Panel } from "../../core/primitives";
import { ChipGroup, FieldRow, PolicyChip } from "./ui";

const BUDGETS = [25, 50, 100] as const;
const STOP_LOSSES = [10, 20, 30] as const;
const CADENCES: readonly WindowCadence[] = ["5m", "15m", "1h"];
const SHIELDS = [1, 2, 3] as const;

const SLIDER_CLASS =
  "[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-lined [&_[data-slot=slider-range]]:bg-lime [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-graphite [&_[data-slot=slider-thumb]]:bg-lime";

function policyKey(c: RunnerConfig) {
  return JSON.stringify([
    c.bias,
    c.budget,
    c.stopLoss,
    c.cadence,
    [...c.assets].sort(),
    c.streakMultiplier,
    c.maxStakePct,
    c.shieldsMax,
    c.headroomGatePct,
  ]);
}

function biasMark(bias: RunnerConfig["bias"]) {
  if (bias === "UP") return <UpMark className="h-4 w-4" aria-hidden />;
  if (bias === "DOWN") return <DownMark className="h-4 w-4" aria-hidden />;
  return null;
}

export function RiskPolicySection() {
  const runner = useRelay((s) => s.runner);
  const config = useRelay((s) => s.config);
  const draft = useRelay((s) => s.draftConfig);
  const setDraft = useRelay((s) => s.setDraftConfig);
  const goScreen = useRelay((s) => s.goScreen);
  const backendLastError = useRelay((s) => s.backendLastError);
  const txPhase = useRelay((s) => s.txPhase);
  const apiError = useRelay((s) => s.apiError);
  const needsSettlementAuth = backendLastError === "needs_outcome_approval";

  const live = runner?.config ?? config;
  const streak = useRelay((s) => s.streak);
  const dirty = policyKey(live) !== policyKey(draft);
  const liveShields =
    isLiveMode() && streak.shieldsMax === 0
      ? "NOT ON-CHAIN"
      : isLiveMode()
        ? `${streak.shields}/${streak.shieldsMax} ON-CHAIN`
        : `${live.shieldsMax} MAX`;

  return (
    <Panel label="RISK POLICY · APPLIES ON NEXT DEPLOY">
      <div className="px-5 pb-5 pt-3">
        {/* ── live summary (read-only) ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="mlabel text-foam/70">LIVE POLICY · LOCKED AT DEPLOY</span>
          <span className="mlabel text-foam/40">RUNNING CONFIG</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <PolicyChip
            label="BIAS"
            value={
              <span className="inline-flex items-center gap-1.5">
                {biasMark(live.bias)}
                {live.bias}
              </span>
            }
            tone={live.bias === "UP" ? "lime" : live.bias === "DOWN" ? "ember" : "cream"}
          />
          <PolicyChip label="BUDGET" value={money(live.budget)} />
          <PolicyChip label="STOP-LOSS" value={money(live.stopLoss)} tone="ember" />
          <PolicyChip label="CADENCE" value={live.cadence} />
          <PolicyChip label="ASSETS" value={live.assets.join(" + ")} />
          <PolicyChip label="STREAK MULT" value={`+${Math.round(live.streakMultiplier * 100)}%`} tone="flame" />
          <PolicyChip label="MAX STAKE" value={`${Math.round(live.maxStakePct * 100)}%`} />
          <PolicyChip label="SHIELDS" value={liveShields} tone="lime" />
          <PolicyChip label="HEADROOM GATE" value={`${Math.round(live.headroomGatePct * 100)}%`} />
        </div>

        {/* ── draft editor ── */}
        <div className="mt-6 border-t-2 border-lined pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="mlabel text-cream">NEXT DEPLOY · EDIT DRAFT</span>
            <span
              className={cn(
                "data rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                dirty ? "bg-flame/15 text-flame" : "text-foam/60"
              )}
            >
              {dirty ? "DRAFT DIFFERS FROM LIVE" : "DRAFT MATCHES LIVE"}
            </span>
          </div>

          <div className="mt-4 grid gap-5">
            <FieldRow
              label="BUDGET"
              live={money(live.budget)}
              hint="MAX BANKROLL THE RUNNER MAY EVER TRADE"
            >
              <ChipGroup
                ariaLabel="Budget"
                options={BUDGETS}
                value={draft.budget}
                onChange={(v) => {
                  const allowed = STOP_LOSSES.filter((sl) => sl <= v);
                  const stop = (allowed as readonly number[]).includes(draft.stopLoss)
                    ? draft.stopLoss
                    : (allowed[allowed.length - 1] ?? v);
                  setDraft({ budget: v, stopLoss: stop });
                }}
                render={(v) => `$${v}`}
              />
            </FieldRow>

            <FieldRow
              label="STOP-LOSS"
              live={money(live.stopLoss)}
              hint="RUNNER PARKS ITSELF AT THIS DRAWDOWN"
            >
              <ChipGroup
                ariaLabel="Stop-loss"
                options={STOP_LOSSES.filter((sl) => sl <= draft.budget)}
                value={draft.stopLoss}
                onChange={(v) => setDraft({ stopLoss: v })}
                render={(v) => `$${v}`}
              />
            </FieldRow>

            <FieldRow label="CADENCE" live={live.cadence} hint="WINDOW LENGTH PER LAP">
              <ChipGroup
                ariaLabel="Cadence"
                options={CADENCES}
                value={draft.cadence}
                onChange={(v) => setDraft({ cadence: v })}
              />
            </FieldRow>

            <FieldRow label="ASSETS" live={live.assets.join(" + ")} hint="ALWAYS AT LEAST ONE BOOK">
              <div className="flex gap-2">
                {(["BTC", "ETH"] as const).map((a: AssetId) => {
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
                        if (next.length === 0) return;
                        setDraft({ assets: next });
                      }}
                      className={cn(
                        "mlabel flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                        on
                          ? "border-lime bg-lime/15 text-lime"
                          : "border-lined text-foam hover:border-foam/60 hover:text-cream"
                      )}
                    >
                      <AssetIcon asset={a} size={18} />
                      {a}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow
              label="STREAK MULTIPLIER"
              value={`+${Math.round(draft.streakMultiplier * 100)}% PER STREAK`}
              live={`+${Math.round(live.streakMultiplier * 100)}%`}
            >
              <Slider
                value={[Math.round(draft.streakMultiplier * 100)]}
                min={0}
                max={20}
                step={1}
                onValueChange={(v) => setDraft({ streakMultiplier: (v[0] ?? 0) / 100 })}
                aria-label="Streak multiplier, percent per streak step"
                className={SLIDER_CLASS}
              />
            </FieldRow>

            <FieldRow
              label="MAX STAKE CAP"
              value={`${Math.round(draft.maxStakePct * 100)}% OF BANKROLL`}
              live={`${Math.round(live.maxStakePct * 100)}%`}
            >
              <Slider
                value={[Math.round(draft.maxStakePct * 100)]}
                min={5}
                max={15}
                step={1}
                onValueChange={(v) => setDraft({ maxStakePct: (v[0] ?? 0) / 100 })}
                aria-label="Max stake cap, percent of bankroll"
                className={SLIDER_CLASS}
              />
            </FieldRow>

            <FieldRow
              label="SHIELDS"
              live={liveShields}
              hint={
                isLiveMode() && streak.shieldsMax === 0
                  ? "NEW VAULT BYTECODE CHARGES SHIELDS ON-CHAIN"
                  : "FIRST LOSS CONSUMES A CHARGE; WINS REFILL UNTIL MAX"
              }
            >
              <ChipGroup
                ariaLabel="Shields"
                options={SHIELDS}
                value={draft.shieldsMax}
                onChange={(v) => setDraft({ shieldsMax: v })}
                render={(v) => (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldMark className="h-4 w-4" aria-hidden />
                    {v}
                  </span>
                )}
              />
            </FieldRow>
          </div>

          <button
            type="button"
            onClick={() => goScreen("deploy")}
            className="mlabel hardshadow-d mt-5 w-full rounded-xl border-2 border-lime bg-lime py-4 text-base text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            APPLY ON NEXT DEPLOY →
          </button>
          {isLiveMode() && streak.shieldsMax === 0 && draft.shieldsMax > 0 ? (
            <>
              <button
                type="button"
                onClick={() => useRelay.getState().chargeShields()}
                className="mlabel mt-3 w-full rounded-xl border-2 border-lined bg-panel2 py-3.5 text-cream transition-colors hover:border-lime hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                CHARGE SHIELDS ON THIS VAULT
              </button>
              {txPhase ? (
                <p
                  className={cn(
                    "data mt-2 text-xs",
                    txPhase.status === "failed" ? "text-ember" : "text-foam",
                  )}
                >
                  {txPhase.label}
                  {txPhase.hash ? ` · ${txPhase.hash.slice(0, 10)}…` : ""}
                </p>
              ) : null}
              {apiError ? <p className="mlabel mt-2 text-ember">{apiError}</p> : null}
            </>
          ) : null}
          {isLiveMode() && needsSettlementAuth ? (
            <button
              type="button"
              onClick={() => useRelay.getState().authorizeRedeem()}
              className="mlabel mt-3 w-full rounded-xl border-2 border-lined bg-panel2 py-3.5 text-cream transition-colors hover:border-lime hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            >
              AUTHORIZE SETTLEMENT ON THIS VAULT
            </button>
          ) : null}
          <p className="data mt-3 text-xs leading-relaxed text-foam">
            {isLiveMode() && needsSettlementAuth
              ? "this vault still needs the owner to grant the markets module as outcome-token operator once. after that, redeem and lap n+1 run unattended."
              : isLiveMode() && streak.shieldsMax === 0
              ? "bias, budget and cadence stay locked mid-run. shields can be charged on this vault if it has the new bytecode."
              : "changes never apply mid-run — your live runner keeps its deployment config."}
          </p>
        </div>
      </div>
    </Panel>
  );
}
