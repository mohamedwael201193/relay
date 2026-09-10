"use client";

/**
 * RELAY — the order book ladder.
 * Two-sided (asks over spread over bids), quoted in UP or DOWN terms,
 * depth bars proportional to size. Compact 2-column form on mobile.
 */

import { useState } from "react";
import { useRelay } from "@/lib/relay/engine/store";
import { Panel } from "@/components/relay/core/primitives";
import { cents, contracts } from "@/lib/relay/format";
import type { BookLevel } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

export function BookPanel({ className }: { className?: string }) {
  const book = useRelay((s) => s.book);
  const [side, setSide] = useState<"UP" | "DOWN">("UP");

  const asks = (side === "UP" ? book.askUp : book.askDown).slice(0, 5);
  const bids = (side === "UP" ? book.bidUp : book.bidDown).slice(0, 5);
  const empty = asks.length === 0 && bids.length === 0;
  const maxSize = empty ? 0 : Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size));

  return (
    <Panel label={`BOOK · ${side} TERMS`} className={className}>
      <div className="px-5 pt-3 flex items-center justify-between gap-3">
        <span className="mlabel text-foam/70">5 × 5 LADDER · SIZE IN CONTRACTS</span>
        <div
          className="flex rounded-lg border-2 border-lined overflow-hidden"
          role="group"
          aria-label="Book side"
        >
          {(["UP", "DOWN"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={cn(
                "mlabel px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40",
                side === s
                  ? s === "UP"
                    ? "bg-lime text-graphite"
                    : "bg-ember text-cream"
                  : "text-foam hover:text-cream"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="px-5 pb-6 pt-4 text-center">
          <span className="mlabel text-foam/60">NO BOOK DEPTH YET</span>
        </div>
      ) : (
        <>
      {/* desktop / tablet ladder */}
      <div className="px-5 pb-4 pt-2 hidden md:block">
        {[...asks].reverse().map((l, i) => (
          <LadderRow key={`ask-${i}`} level={l} maxSize={maxSize} tone="ask" />
        ))}
        <div className="flex items-center justify-center border-y-2 border-lined bg-panel2/50 py-1.5 my-1">
          <span className="data text-xs text-foam">SPREAD {cents(book.spread)}</span>
        </div>
        {bids.map((l, i) => (
          <LadderRow key={`bid-${i}`} level={l} maxSize={maxSize} tone="bid" />
        ))}
      </div>

      {/* mobile compact 2-column */}
      <div className="md:hidden grid grid-cols-2 gap-x-2 gap-y-0.5 px-3 pb-4 pt-2">
        <div>
          <div className="mlabel text-ember/80 mb-1 px-2">ASKS</div>
          {[...asks].reverse().slice(0, 3).map((l, i) => (
            <LadderRow key={`m-ask-${i}`} level={l} maxSize={maxSize} tone="ask" compact />
          ))}
        </div>
        <div>
          <div className="mlabel text-lime mb-1 px-2">BIDS</div>
          {bids.slice(0, 3).map((l, i) => (
            <LadderRow key={`m-bid-${i}`} level={l} maxSize={maxSize} tone="bid" compact />
          ))}
        </div>
        <div className="col-span-2 data text-xs text-foam text-center border-t-2 border-lined pt-1.5 mt-1">
          SPREAD {cents(book.spread)}
        </div>
      </div>
        </>
      )}
    </Panel>
  );
}

function LadderRow({
  level,
  maxSize,
  tone,
  compact = false,
}: {
  level: BookLevel;
  maxSize: number;
  tone: "ask" | "bid";
  compact?: boolean;
}) {
  const w = Math.max(4, Math.round((level.size / maxSize) * 100));
  return (
    <div className={cn("relative flex items-center justify-between", compact ? "px-1.5 py-1" : "px-3 py-1.5")}>
      <div
        className={cn("absolute inset-y-[3px] right-1.5 rounded-sm", tone === "ask" ? "bg-ember/25" : "bg-lime/25")}
        style={{ width: `${w}%` }}
        aria-hidden
      />
      <span
        className={cn(
          "data font-semibold relative",
          compact ? "text-xs" : "text-sm",
          tone === "ask" ? "text-ember" : "text-lime"
        )}
      >
        {cents(level.price)}
      </span>
      <span className={cn("data text-foam relative", compact ? "text-[0.7rem]" : "text-xs")}>
        {contracts(level.size)}
      </span>
    </div>
  );
}
