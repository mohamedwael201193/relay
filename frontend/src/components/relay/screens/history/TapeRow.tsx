"use client";

/**
 * RELAY — the tape row.
 * One settled lap as an auditable line: lap №, market, side, stake/
 * entry, outcome, pnl, streak, settled — expandable into the full
 * receipt (order & fill / settlement / proof) with real tx hashes.
 */

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Check } from "lucide-react";
import type { Lap } from "@/lib/relay/types";
import {
  cents,
  clock,
  contracts,
  hhmm,
  money,
  price,
  shortHash,
  signed,
} from "@/lib/relay/format";
import { explorerTxUrl } from "@/lib/relay/config/network";
import { AssetIcon, FlameMark, VerifiedSeal } from "../../identity/identity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MonoRow, OutcomeChip, SideChip, TAPE_GRID } from "./bits";

interface Props {
  lap: Lap;
  now: number;
  open: boolean;
  onToggle: () => void;
}

const pnlTone = (v: number) => (v > 0 ? "text-lime" : v < 0 ? "text-ember" : "text-foam");

function InspectLink({ hash }: { hash: string }) {
  const url = explorerTxUrl(hash);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={url ?? "#"}
          target={url ? "_blank" : undefined}
          rel={url ? "noopener noreferrer" : undefined}
          onClick={url ? undefined : (e) => e.preventDefault()}
          className="mlabel inline-flex items-center gap-1 rounded-md text-lime underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          INSPECT <ArrowUpRight className="h-3 w-3" aria-hidden />
        </a>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="border-2 border-lined bg-panel2 text-xs font-normal text-cream"
      >
        Shannon explorer
      </TooltipContent>
    </Tooltip>
  );
}

function ProofCheck({ label, hash }: { label: string; hash: string }) {
  const url = explorerTxUrl(hash);
  return (
    <div className="flex items-center gap-2 border-b border-lined/70 py-1.5 last:border-b-0">
      <Check className="h-3.5 w-3.5 shrink-0 text-lime" strokeWidth={3} aria-hidden />
      <span className="mlabel shrink-0 text-foam/75">{label}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="data ml-auto min-w-0 truncate text-[0.65rem] text-foam underline decoration-lined underline-offset-2 hover:text-cream"
        >
          {shortHash(hash)}
        </a>
      ) : (
        <span className="data ml-auto min-w-0 truncate text-[0.65rem] text-foam">
          {shortHash(hash)}
        </span>
      )}
    </div>
  );
}

function LapReceipt({ lap }: { lap: Lap }) {
  const m = lap.market;
  const claimLabel = lap.outcome === "VOID" ? "VOID REFUND" : "CLAIM TX";
  const outcomeTone =
    lap.marketOutcome === "UP" ? "lime" : lap.marketOutcome === "DOWN" ? "ember" : "foam";
  const colCls =
    "border-t-2 border-lined/60 pt-4 mt-4 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-5 lg:mt-0";

  return (
    <div className="rounded-xl border-2 border-lined bg-panel2/40 p-4">
      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1 — order & fill */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="mlabel text-foam">ORDER &amp; FILL</span>
            {lap.order.latencyMs > 0 ? (
              <span className="mlabel rounded-md border-2 border-limedeep/50 bg-lime/10 px-1.5 py-0.5 text-lime">
                {lap.order.latencyMs}MS
              </span>
            ) : null}
          </div>
          <div className="mt-2">
            <MonoRow label="KIND" value={lap.order.kind} />
            <MonoRow label="SIDE" value={lap.side === "UP" ? "▲ UP" : "▼ DOWN"} tone={lap.side === "UP" ? "lime" : "ember"} />
            <MonoRow label="PRICE" value={cents(lap.order.price)} />
            <MonoRow label="QUANTITY" value={`${contracts(lap.fill.quantity)} contracts`} />
            <MonoRow label="STAKE" value={money(lap.stake)} />
            <MonoRow label="PLACED" value={clock(lap.order.placedAt)} tone="foam" />
            <MonoRow
              label="ORDER TX"
              value={
                lap.order.tx.block > 0
                  ? `${shortHash(lap.order.tx.hash)} · #${lap.order.tx.block}`
                  : shortHash(lap.order.tx.hash)
              }
              tone="foam"
            />
          </div>
        </div>

        {/* 2 — settlement */}
        <div className={cn(colCls, "min-w-0")}>
          <span className="mlabel text-foam">SETTLEMENT</span>
          <div className="mt-2">
            <MonoRow label="WINDOW" value={`${hhmm(m.windowStart)}–${hhmm(m.windowEnd)}`} tone="foam" />
            <MonoRow
              label="OPEN → CLOSE"
              value={`${price(m.openPrice, m.asset)} → ${price(m.closePrice, m.asset)}`}
            />
            <MonoRow label="MARKET" value={lap.marketOutcome} tone={outcomeTone} />
            <MonoRow label="ORACLE Q" value={shortHash(lap.proof.oracleQuestionId)} tone="foam" />
            <MonoRow label="SETTLE TX" value={shortHash(lap.proof.settlementTx)} tone="foam" />
            <MonoRow label={claimLabel} value={shortHash(lap.proof.claimTx)} tone="foam" />
          </div>
        </div>

        {/* 3 — proof */}
        <div className={cn(colCls, "min-w-0")}>
          <span className="mlabel text-foam">PROOF</span>
          <div className="mt-2 flex items-start gap-4">
            <VerifiedSeal size={64} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="data text-base font-bold leading-none text-cream">
                  LAP {lap.number}
                </span>
                <span className="mlabel text-lime">VERIFIED</span>
              </div>
              <div className="mt-1.5">
                <ProofCheck label="FILL" hash={lap.proof.fillTx} />
                {lap.proof.settlementTx ? <ProofCheck label="SETTLEMENT" hash={lap.proof.settlementTx} /> : null}
                {lap.proof.claimTx ? (
                  <ProofCheck label={lap.outcome === "VOID" ? "REFUND" : "CLAIM"} hash={lap.proof.claimTx} />
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-lined/70 pt-3">
            <span className="mlabel text-foam/60">
              SEALED {clock(lap.proof.sealedAt)} · SOMNIA REACTIVITY
            </span>
            <InspectLink hash={lap.proof.fillTx || lap.order.tx.hash} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TapeRow({ lap, now, open, onToggle }: Props) {
  const receiptId = `tape-receipt-${lap.number}`;
  return (
    <div className="border-b-2 border-lined last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={receiptId}
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 text-left transition-colors hover:bg-panel2/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime",
          open && "bg-panel2/40"
        )}
      >
        {/* desktop ledger line */}
        <div className={cn("hidden items-center gap-3 lg:grid", TAPE_GRID)}>
          <span className="data text-lg font-bold tabular-nums text-cream">{lap.number}</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <AssetIcon asset={lap.market.asset} size={22} />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-bold">{lap.market.asset}</span>
                <span className="mlabel text-foam">
                  {lap.market.cadence} · {hhmm(lap.market.windowEnd)}
                </span>
              </span>
              <span className="data block truncate text-[0.6rem] leading-relaxed text-foam/70">
                {shortHash(lap.market.marketId)}
              </span>
            </span>
          </span>
          <span>
            <SideChip side={lap.side} />
          </span>
          <span className="data text-sm">
            {money(lap.stake)}{" "}
            <span className="text-foam">@ {cents(lap.entryPrice)}</span>
          </span>
          <span>
            <OutcomeChip outcome={lap.outcome} shielded={lap.shielded} />
          </span>
          <span className={cn("data text-lg font-semibold tabular-nums", pnlTone(lap.pnl))}>
            {signed(lap.pnl)}
          </span>
          <span className="flex items-center gap-1">
            {lap.streakAfter > 0 && <FlameMark className="h-3.5 w-3" aria-hidden />}
            <span
              className={cn(
                "data text-sm tabular-nums",
                lap.streakAfter > 0 ? "text-flame" : "text-foam/60"
              )}
            >
              ×{lap.streakAfter}
            </span>
          </span>
          <span className="data text-xs text-foam">{agoOf(lap.settledAt, now)}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-foam transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </div>

        {/* mobile 2-line card */}
        <div className="flex items-center gap-3 lg:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="data w-9 shrink-0 text-lg font-bold tabular-nums text-cream">
                  {lap.number}
                </span>
                <AssetIcon asset={lap.market.asset} size={20} />
                <span className="truncate text-sm font-bold">{lap.market.asset}</span>
                <span className="mlabel shrink-0 text-foam">{lap.market.cadence}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <OutcomeChip outcome={lap.outcome} shielded={lap.shielded} />
                <span className={cn("data text-lg font-semibold tabular-nums", pnlTone(lap.pnl))}>
                  {signed(lap.pnl)}
                </span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <SideChip side={lap.side} />
              <span className="data text-xs text-foam">
                {money(lap.stake)} <span className="text-foam/70">@ {cents(lap.entryPrice)}</span>
              </span>
              <span className="flex items-center gap-1">
                {lap.streakAfter > 0 && <FlameMark className="h-3 w-2.5" aria-hidden />}
                <span className="data text-xs text-flame">×{lap.streakAfter}</span>
              </span>
              <span className="data text-xs text-foam/80">
                {hhmm(lap.market.windowEnd)} · {agoOf(lap.settledAt, now)}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-foam transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      {/* expanded receipt */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="receipt"
            id={receiptId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <LapReceipt lap={lap} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function agoOf(settledAt: number, now: number) {
  const s = Math.max(0, Math.floor((now - settledAt) / 1000));
  if (s < 60) return `${s}s ago`;
  const mnt = Math.floor(s / 60);
  if (mnt < 60) return `${mnt}m ago`;
  const h = Math.floor(mnt / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
