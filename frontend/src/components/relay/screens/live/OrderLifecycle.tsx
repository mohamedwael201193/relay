"use client";

/**
 * RELAY — THE ORDER CARD (the star of the Live Lap screen).
 * Animates the full lifecycle of a lap's order:
 * SCAN (radar) → ARMED (decision) → ORDER (in flight) → FILL (receipt) → HOLD (position).
 */

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Radar } from "lucide-react";
import { selectLivePnl, useRelay } from "@/lib/relay/engine/store";
import { Panel } from "@/components/relay/core/primitives";
import { AssetIcon, DownMark, UpMark } from "@/components/relay/identity/identity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cents, contracts, hhmm, money, shortHash, signed } from "@/lib/relay/format";
import { explorerTxUrl } from "@/lib/relay/config/network";
import type { FillRecord, LapPhase, MarketWindow, OrderRecord, Position, Side } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { useFlash } from "./helpers";

type Decision = { side: Side; stake: number; entry: number };

export function OrderLifecycle({ className }: { className?: string }) {
  const lap = useRelay((s) => s.liveLap);
  const decision = useRelay((s) => s.decision);
  const calendar = useRelay((s) => s.calendar);
  const latencyMs = useRelay((s) => s.latencyMs);
  const livePnl = selectLivePnl(lap);
  const pnlFlash = useFlash(livePnl);

  if (!lap) return null;
  const { phase, order, fill, position } = lap;

  const stage: "scan" | "armed" | "order" | "fill" | "hold" =
    phase === "SCAN"
      ? "scan"
      : phase === "ARMED"
        ? "armed"
        : phase === "ORDER" || (phase === "FILL" && !fill)
          ? "order"
          : phase === "FILL"
            ? "fill"
            : "hold";

  return (
    <Panel label={`ORDER FLOW · LAP ${lap.number}`} className={className}>
      <div className="px-5 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {stage === "scan" && <ScanBody calendar={calendar} />}
            {stage === "armed" &&
              (decision ? <ArmedBody decision={decision} /> : <PreparingBody />)}
            {stage === "order" &&
              (order ? <OrderBody order={order} latencyMs={latencyMs} /> : <PreparingBody />)}
            {stage === "fill" &&
              (fill && order ? <FillBody fill={fill} order={order} /> : <PreparingBody />)}
            {stage === "hold" &&
              (position ? (
                <HoldBody position={position} phase={phase} pnl={livePnl} flash={pnlFlash} />
              ) : (
                <PreparingBody />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Panel>
  );
}

/* ── shared spec tile ───────────────────────────────────────── */

function Spec({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "UP" | "DOWN";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border-2 border-lined bg-panel2/60 px-3.5 py-3 min-w-0", className)}>
      <div className="mlabel text-foam/80 truncate">{label}</div>
      <div
        className={cn(
          "data font-semibold mt-1.5 leading-none",
          tone === "UP" ? "text-lime" : tone === "DOWN" ? "text-ember" : "text-cream"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PreparingBody() {
  return (
    <div className="flex items-center gap-3 py-3" aria-live="polite">
      <Loader2 className="w-5 h-5 text-flame animate-spin" aria-hidden />
      <span className="data text-sm text-foam">preparing…</span>
    </div>
  );
}

/* ── SCAN: radar + calendar ─────────────────────────────────── */

function ScanBody({ calendar }: { calendar: MarketWindow[] }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14 grid place-items-center shrink-0" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-lime/50"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.06], opacity: [0.65, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
            />
          ))}
          <Radar className="w-5 h-5 text-lime" />
        </div>
        <div>
          <div
            className="data text-lg font-bold wide text-cream tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            SCANNING WINDOWS…
          </div>
          <div className="mlabel text-foam mt-1">DREAMDEX EVENT CONTRACTS · NEXT 3</div>
        </div>
      </div>

      <div className="mt-4 border-2 border-lined rounded-xl divide-y divide-lined/60">
        {calendar.slice(0, 3).map((w, i) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
            <AssetIcon asset={w.asset} size={20} />
            <span className="mlabel text-cream/90">{w.asset} UP OR DOWN</span>
            <span className="mlabel text-foam/60">{w.cadence.toUpperCase()}</span>
            {i === 0 && <span className="mlabel text-flame">NEXT</span>}
            <span className="ml-auto data text-xs text-foam">OPENS {hhmm(w.opensAt)}</span>
          </div>
        ))}
        {calendar.length === 0 && (
          <div className="px-4 py-3 mlabel text-foam/60">NO WINDOWS ON THE CALENDAR…</div>
        )}
      </div>
    </div>
  );
}

/* ── ARMED: decision prepared ───────────────────────────────── */

function ArmedBody({ decision }: { decision: Decision }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
        >
          {decision.side === "UP" ? (
            <UpMark className="w-8 h-8" />
          ) : (
            <DownMark className="w-8 h-8" />
          )}
        </motion.div>
        <div>
          <div
            className="data text-lg font-bold wide text-flame tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            DECISION PREPARED
          </div>
          <div className="mlabel text-foam mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-flame blink" aria-hidden />
            WAITING FOR ENTRY WINDOW
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Spec label="PLANNED STAKE" value={money(decision.stake)} />
        <Spec label="PLANNED ENTRY" value={cents(decision.entry)} />
        <Spec
          label="BIAS"
          value={decision.side === "UP" ? "▲ UP" : "▼ DOWN"}
          tone={decision.side}
        />
      </div>
    </div>
  );
}

/* ── ORDER: submitted, in flight ────────────────────────────── */

function OrderBody({ order, latencyMs }: { order: OrderRecord; latencyMs: number }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-flame animate-spin" aria-hidden />
        <div>
          <div
            className="data text-lg font-bold wide text-flame tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ORDER SUBMITTED
          </div>
          <div className="mlabel text-foam mt-1">ORDER ACCEPTED · WAITING FOR FILL</div>
        </div>
        <span className="ml-auto mlabel px-2 py-1 rounded-md border border-lined text-foam/80">
          {order.kind}
        </span>
      </div>

      <div className="mt-4 relative overflow-hidden rounded-xl border-2 border-flame/40 bg-panel2/60 px-4 py-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Spec
            label="SIDE"
            value={order.side === "UP" ? "▲ UP" : "▼ DOWN"}
            tone={order.side}
          />
          <Spec label="PRICE" value={cents(order.price)} />
          <Spec label="QUANTITY" value={`${contracts(order.quantity)} CT`} />
          <Spec label="STAKE" value={money(order.stake)} />
        </div>
        {/* progress shimmer */}
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-flame/15 to-transparent"
          animate={{ x: ["-130%", "340%"] }}
          transition={{ repeat: Infinity, duration: 1.7, ease: "linear" }}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <span className="data text-[0.7rem] text-foam/90 px-2 py-1 rounded-md border border-lined">
          EST. LATENCY {latencyMs}MS
        </span>
        <span className="mlabel text-foam/50">ZERO FEES · GAS SPONSORED</span>
      </div>
    </div>
  );
}

/* ── FILL: receipt reveal ───────────────────────────────────── */

function FillBody({ fill, order }: { fill: FillRecord; order: OrderRecord }) {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl border-2 border-lime/60 overflow-hidden"
    >
      {/* lime flash on reveal */}
      <motion.div
        className="absolute inset-0 bg-lime/15 pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        aria-hidden
      />
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          {order.side === "UP" ? <UpMark className="w-7 h-7" /> : <DownMark className="w-7 h-7" />}
          <span
            className="data text-lg font-bold wide text-lime tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            FILLED — SAME BLOCK
          </span>
          <span className="ml-auto data text-[0.7rem] font-semibold px-2.5 py-1 rounded-md bg-lime text-graphite">
            order→confirm {order.latencyMs}ms
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Spec label="FILL PRICE" value={cents(fill.price)} />
          <Spec label="QUANTITY" value={`${contracts(fill.quantity)} CT`} />
          <Spec label="STAKE" value={money(order.stake)} />
          <Spec
            label="SIDE"
            value={order.side === "UP" ? "▲ UP" : "▼ DOWN"}
            tone={order.side}
          />
        </div>

        <div className="mt-3.5 flex items-center gap-2 flex-wrap">
          <span className="mlabel text-foam/70">FILL TX</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={explorerTxUrl(fill.tx.hash) ?? "#"}
                target={explorerTxUrl(fill.tx.hash) ? "_blank" : undefined}
                rel={explorerTxUrl(fill.tx.hash) ? "noopener noreferrer" : undefined}
                onClick={explorerTxUrl(fill.tx.hash) ? undefined : (e) => e.preventDefault()}
                className="data text-xs text-cream/90 underline decoration-lined underline-offset-2 hover:decoration-cream transition-colors"
                aria-label="Fill transaction, Shannon explorer"
              >
                {shortHash(fill.tx.hash)}
              </a>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="data text-xs">inspect on Shannon explorer</span>
            </TooltipContent>
          </Tooltip>
          <span className="mlabel text-foam/50">BLOCK {fill.tx.block}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── HOLD → settlement: the position card ───────────────────── */

function HoldBody({
  position,
  phase,
  pnl,
  flash,
}: {
  position: Position;
  phase: LapPhase;
  pnl: number;
  flash: { key: number; tone: "up" | "down" | null };
}) {
  const closing = phase === "CLOSING" || phase === "ORACLE" || phase === "RESULT" || phase === "CLAIM" || phase === "REARM";
  const pnlTone = pnl > 0 ? "text-lime" : pnl < 0 ? "text-ember" : "text-cream";
  const markTone =
    position.markPrice >= position.entryPrice ? "text-lime" : "text-ember";

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            "data font-bold text-sm px-2.5 py-1 rounded-md border-2 border-graphite",
            position.side === "UP" ? "bg-lime text-graphite" : "bg-ember text-cream"
          )}
        >
          {position.side === "UP" ? "▲ UP" : "▼ DOWN"}
        </span>
        <span className="mlabel text-foam">RIDING TO SETTLEMENT</span>
        <span
          className="ml-auto mlabel"
          style={{ color: closing ? "#f0512a" : "#aae83c" }}
        >
          {closing ? "WINDOW CLOSING" : "POSITION LIVE"}
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <Spec label={`ENTRY · ${position.side} TERMS`} value={cents(position.entryPrice)} />
        <div className="rounded-xl border-2 border-lined bg-panel2/60 px-3.5 py-3 min-w-0">
          <div className="mlabel text-foam/80 truncate">MARK · {position.side} TERMS</div>
          <div className={cn("data font-semibold mt-1.5 leading-none", markTone)}>
            {cents(position.markPrice)}
          </div>
        </div>
        <Spec label="STAKE" value={money(position.stake)} />
        <Spec label="QUANTITY" value={`${contracts(position.quantity)} CT`} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 rounded-xl border-2 border-lined bg-panel2/40 px-4 py-3.5">
        <div>
          <div className="mlabel text-foam/80">LIVE PNL · UNSETTLED</div>
          <motion.div
            key={flash.key}
            className={cn("data text-3xl font-semibold mt-1.5 leading-none", pnlTone)}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            aria-live="polite"
          >
            {signed(pnl)}
          </motion.div>
        </div>
        <div className="text-right">
          <div className="mlabel text-foam/60">IF WIN PAYS</div>
          <div className="data text-sm text-foam mt-1.5">
            {money(position.quantity * (1 - position.entryPrice), { sign: true })}
          </div>
        </div>
      </div>
    </div>
  );
}
