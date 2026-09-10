"use client";

/**
 * RELAY landing — sticker & diagram components.
 * Every sticker is store-driven: the wall of windows uses real lap history,
 * the baton pass uses the last settled lap + the live lap, the streak
 * composition uses live streak/shield state, the receipt uses real proofs.
 */

import { Fragment } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelay } from "@/lib/relay/engine/store";
import { cents, countdown, hhmm, shortHash, signed } from "@/lib/relay/format";
import { AssetIcon, BatonGlyph, FlameMark, ShieldMark, VerifiedSeal } from "../identity/identity";

const INK = "#1a1610";
const CREAM = "#fcf9ef";
const LIME = "#aae83c";

/* ── SECTION 1 — the wall of windows (the old way) ──────────── */

export function WallOfWindows({ className }: { className?: string }) {
  const liveLap = useRelay((s) => s.liveLap);
  const laps = useRelay((s) => s.laps);

  return (
    <div className={cn("relative", className)} role="img" aria-label="A dense wall of market windows that settled while you were away">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6">
        {liveLap && (
          <div className="rounded-lg border-2 border-ink bg-lime px-2.5 py-2 text-graphite hardshadow-sm -rotate-1">
            <div className="flex items-center justify-between gap-1">
              <span className="data text-[0.7rem] font-bold">{liveLap.market.asset} LIVE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-ink blink" aria-hidden />
            </div>
            <div className="data text-sm font-bold mt-1">{cents(liveLap.probUp)}</div>
            <div className="data text-[0.5625rem] uppercase tracking-[0.12em] mt-1 opacity-80">
              {countdown(liveLap.countdownMs)} LEFT
            </div>
          </div>
        )}
        {laps.map((l) => (
          <div key={l.number} className="rounded-lg border-2 border-linen bg-cardp px-2.5 py-2 opacity-70">
            <div className="flex items-center justify-between gap-1">
              <span className="data text-[0.7rem] font-semibold text-ink2">{hhmm(l.settledAt)}</span>
              <X className="h-3 w-3 text-ink3" strokeWidth={2.5} aria-label="missed" />
            </div>
            <div className="data text-sm font-semibold text-ink3 mt-1">{cents(l.entryPrice)}</div>
            <div className="data text-[0.5625rem] uppercase tracking-[0.12em] text-ink3 mt-1">MISSED</div>
          </div>
        ))}
      </div>
      <ClaimSticker className="absolute -bottom-7 right-1 sm:-right-3" />
    </div>
  );
}

export function ClaimSticker({ className }: { className?: string }) {
  return (
    <div className={cn("sticker rotate-[6deg] px-4 py-2.5", className)} aria-hidden>
      <span className="mlabel px-1">CLAIM</span>
      <svg viewBox="0 0 64 26" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M7 5 L57 21" stroke="#f0512a" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M7 21 L57 5" stroke="#f0512a" strokeWidth="3.2" strokeLinecap="round" opacity="0.55" />
      </svg>
    </div>
  );
}

/* ── SECTION 2 — the baton pass (one window = one lap) ──────── */

export function BatonPassDiagram({ className }: { className?: string }) {
  const laps = useRelay((s) => s.laps);
  const live = useRelay((s) => s.liveLap);
  const prev = laps.length ? laps[laps.length - 1] : null;
  const prevTone = !prev
    ? "text-ink2"
    : prev.outcome === "WIN"
      ? "text-limedeep"
      : prev.outcome === "LOSS"
        ? "text-emberdeep"
        : "text-ink2";

  return (
    <div className={cn("flex flex-col items-center justify-center gap-7 py-8 sm:flex-row sm:gap-10", className)}>
      {/* settled lap card */}
      <div className="sticker w-44 -rotate-2 px-4 py-3.5">
        <div className="mlabel text-ink2">LAP {prev?.number ?? "—"} · SETTLED</div>
        <div className="mt-2.5 flex items-center gap-2">
          <AssetIcon asset={prev?.market.asset ?? "BTC"} size={22} />
          <span className="text-sm font-bold">
            {prev?.market.asset ?? "BTC"} {prev?.side ?? "UP"}
          </span>
        </div>
        <div className={cn("data mt-1.5 text-sm font-semibold", prevTone)}>
          {prev ? signed(prev.pnl) : "—"}
          {prev?.shielded ? <span className="text-flamedeep"> · SHIELDED</span> : null}
        </div>
      </div>

      {/* the flying baton */}
      <div className="relative h-16 w-full max-w-[280px]">
        <svg viewBox="0 0 280 56" className="h-full w-full" aria-hidden>
          <path
            d="M4 42 C 80 4, 200 4, 276 42"
            fill="none"
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray="14 14"
            className="lane-flow"
          />
          <circle cx="6" cy="41" r="3.5" fill={INK} />
          <circle cx="274" cy="41" r="3.5" fill={INK} />
        </svg>
        <div className="baton-fly top-1/2 -translate-y-1/2">
          <BatonGlyph glow className="h-auto w-[52px]" />
        </div>
      </div>

      {/* live lap card */}
      <div className="sticker w-44 rotate-2 px-4 py-3.5">
        <div className="mlabel text-ink2">
          LAP {live?.number ?? "—"} · {live?.phase ?? "ARMED"}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <AssetIcon asset={live?.market.asset ?? "ETH"} size={22} />
          <span className="text-sm font-bold">{live?.market.asset ?? "ETH"} IN FLIGHT</span>
        </div>
        <div className="data mt-1.5 text-sm font-semibold text-ink">
          {live ? `${countdown(live.countdownMs)} TO SETTLE` : "—"}
        </div>
      </div>
    </div>
  );
}

/* ── SECTION 4 — the autonomous loop diagram ────────────────── */

const LOOP_NODES = ["WINDOW", "FILL", "ORACLE", "CLAIM", "RE-ARM"] as const;

function loopChip(node: (typeof LOOP_NODES)[number]) {
  return cn(
    "mlabel inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 px-2.5 py-2",
    node === "ORACLE"
      ? "bg-panel text-oracle border-oracle/40"
      : node === "RE-ARM"
        ? "bg-panel text-lime border-lime/40"
        : "bg-panel text-cream border-lined"
  );
}

export function LoopDiagram({ className }: { className?: string }) {
  return (
    <div className={cn("my-8 sm:my-10", className)} aria-label="The settlement loop: window, fill, oracle, claim, re-arm">
      {/* mobile: wrapped chips with chevrons */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:hidden">
        {LOOP_NODES.map((node, i) => (
          <Fragment key={node}>
            <span className={loopChip(node)}>
              {node === "ORACLE" && <span className="w-1.5 h-1.5 rounded-full bg-oracle blink" aria-hidden />}
              {node}
            </span>
            {i < LOOP_NODES.length - 1 && <ChevronRight className="h-4 w-4 text-foam/60" aria-hidden />}
          </Fragment>
        ))}
      </div>

      {/* sm+: nodes on a flowing track with a moving baton */}
      <div className="relative hidden h-16 overflow-hidden rounded-2xl border-2 border-lined bg-panel2/50 sm:block">
        <div className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 track-dash dashflow text-lime/60" aria-hidden />
        <div className="relative flex h-full items-center justify-between px-5">
          {LOOP_NODES.map((node) => (
            <span key={node} className={loopChip(node)}>
              {node === "ORACLE" && <span className="w-1.5 h-1.5 rounded-full bg-oracle blink" aria-hidden />}
              {node}
            </span>
          ))}
        </div>
        <div className="loop-run top-1/2 -translate-y-[7px]">
          <div className="h-3.5 w-[34px] rounded-full border-2 border-graphite bg-lime shadow-[0_0_14px_rgba(170,232,60,0.55)]" />
        </div>
      </div>
    </div>
  );
}

/* ── SECTION 5 — streak & shield sticker composition ────────── */

export function StreakComposition({ className }: { className?: string }) {
  const streak = useRelay((s) => s.streak);
  const laps = useRelay((s) => s.laps);
  const recent = laps.slice(-10);
  const wins = recent.filter((l) => l.outcome === "WIN").length;
  const losses = recent.filter((l) => l.outcome === "LOSS").length;
  const voids = recent.filter((l) => l.outcome === "VOID").length;

  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      {/* the streak */}
      <div className="sticker -rotate-2 flex items-center gap-4 px-5 py-4">
        <FlameMark className="h-11 w-auto" animated />
        <div>
          <div className="data text-4xl font-semibold leading-none">×{streak.current}</div>
          <div className="mlabel mt-1.5 text-ink2">STREAK · BEST ×{streak.best}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* the shields */}
        <div className="sticker rotate-[1.5deg] flex items-center gap-3 px-4 py-3.5">
          <ShieldMark className="h-9 w-auto" />
          <div>
            <div className="data text-2xl font-semibold leading-none">
              ×{streak.shields}/{streak.shieldsMax}
            </div>
            <div className="mlabel mt-1 text-ink2">SHIELDS · {streak.protectedCount} LOSSES EATEN</div>
          </div>
        </div>

        {/* recent lap outcomes */}
        <div className="sticker -rotate-1 px-4 py-3.5">
          <div className="mlabel text-ink2">LAST {recent.length} LAPS</div>
          <div
            className="mt-3 flex items-end gap-1.5"
            role="img"
            aria-label={`Recent lap outcomes: ${wins} wins, ${losses} losses, ${voids} voids`}
          >
            {recent.map((l) => (
              <div key={l.number} className="relative" title={`Lap ${l.number}: ${l.outcome}`}>
                <div
                  className={cn(
                    "h-10 w-5 rounded-md border-2 border-ink",
                    l.outcome === "WIN" ? "bg-lime" : l.outcome === "LOSS" ? "bg-ember" : "bg-paper2"
                  )}
                />
                {l.shielded && <ShieldMark className="absolute -right-2 -top-2.5 h-5 w-auto" filled />}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4">
            {[
              { label: "WIN", cls: "bg-lime" },
              { label: "LOSS", cls: "bg-ember" },
              { label: "VOID", cls: "bg-paper2" },
            ].map((lg) => (
              <span key={lg.label} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm border border-ink", lg.cls)} aria-hidden />
                <span className="data text-[0.6rem] font-semibold tracking-[0.14em] text-ink2">{lg.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="h-0.5 w-48 track-dash text-ink3" aria-hidden />
    </div>
  );
}

/* ── SECTION 6 — vault + receipt illustration ───────────────── */

export function VaultReceipt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 240" className={className} role="img" aria-label="Your funds stay locked in your own vault while a settlement receipt prints beside it">
      {/* vault body */}
      <rect x="44" y="54" width="140" height="140" rx="18" fill={INK} opacity="0.9" />
      <rect x="40" y="50" width="140" height="140" rx="18" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      {/* dial */}
      <circle cx="110" cy="120" r="40" fill="#ece5d1" stroke={INK} strokeWidth="2.5" />
      <g stroke={INK} strokeWidth="3" strokeLinecap="round">
        <line x1="110" y1="86" x2="110" y2="154" />
        <line x1="76" y1="120" x2="144" y2="120" />
        <line x1="86" y1="96" x2="134" y2="144" />
        <line x1="134" y1="96" x2="86" y2="144" />
      </g>
      <circle cx="110" cy="120" r="6" fill={INK} />
      {/* side bolts */}
      <rect x="182" y="98" width="15" height="12" rx="3" fill={LIME} stroke={INK} strokeWidth="2" />
      <rect x="182" y="126" width="15" height="12" rx="3" fill={LIME} stroke={INK} strokeWidth="2" />
      {/* feet */}
      <rect x="58" y="190" width="18" height="10" rx="3" fill={INK} />
      <rect x="146" y="190" width="18" height="10" rx="3" fill={INK} />

      {/* receipt */}
      <g transform="translate(190 86) rotate(8)">
        <rect x="4" y="4" width="64" height="98" fill={INK} opacity="0.9" />
        <path
          d="M0 0 H64 V98 L56 91 L48 98 L40 91 L32 98 L24 91 L16 98 L8 91 L0 98 Z"
          fill={CREAM}
          stroke={INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <rect x="8" y="12" width="48" height="4" rx="2" fill={INK} opacity="0.85" />
        <rect x="8" y="21" width="36" height="3" rx="1.5" fill="#a89d84" />
        <rect x="8" y="28" width="44" height="3" rx="1.5" fill="#a89d84" />
        <line x1="8" y1="40" x2="56" y2="40" stroke="#d9d2bb" strokeWidth="1.5" strokeDasharray="3 3" />
        <rect x="8" y="48" width="11" height="11" rx="2.5" fill={LIME} stroke={INK} strokeWidth="1.8" />
        <path d="M11 53.5 l2.5 2.5 4.5 -5.5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="24" y="51" width="32" height="3.5" rx="1.75" fill="#a89d84" />
        <rect x="8" y="66" width="40" height="3" rx="1.5" fill="#a89d84" />
        <rect x="8" y="74" width="28" height="3" rx="1.5" fill="#a89d84" />
      </g>
    </svg>
  );
}

/* ── SECTION 8 — the verified receipt card ──────────────────── */

export function ProofReceipt({ className }: { className?: string }) {
  const laps = useRelay((s) => s.laps);
  const last = laps.length ? laps[laps.length - 1] : null;
  const proof = last?.proof;

  const rows = [
    { label: "FILL", hash: proof?.fillTx },
    { label: "SETTLEMENT", hash: proof?.settlementTx },
    { label: "CLAIM", hash: proof?.claimTx },
  ];

  return (
    <div className={cn("sticker relative w-full max-w-lg -rotate-[0.5deg] px-6 py-7 sm:px-8", className)}>
      <VerifiedSeal size={88} className="absolute -right-4 -top-8 rotate-[10deg] sm:-right-6" />
      <div className="mlabel text-ink2">PROOF OF SETTLEMENT</div>
      <h3 className="data mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
        LAP {last?.number ?? "—"} — VERIFIED
      </h3>
      <div className="mt-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 border-t border-dashed border-linen py-3">
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-lime">
                <Check className="h-3 w-3 text-graphite" strokeWidth={3.2} aria-hidden />
              </span>
              <span className="mlabel text-ink">{r.label}</span>
            </span>
            <span className="data truncate text-[0.8rem] text-ink2">
              {r.hash ? shortHash(r.hash) : "0x pending…"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 mlabel text-ink3">
        SEALED {proof ? hhmm(proof.sealedAt) : "--:--"} · SOMNIA · SHANNON TESTNET
      </div>
    </div>
  );
}
