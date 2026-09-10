"use client";

/**
 * RELAY — live boost ticker.
 * Production lists BoostController events from /v1/arena.
 * Demo mode keeps seeded chatter derived from the arena array.
 */

import { useMemo } from "react";

import { useRelay } from "@/lib/relay/engine/store";
import { isLiveMode } from "@/lib/relay/live/mode";
import { cn } from "@/lib/utils";
import { tickerItems, type TickerItem } from "./synth";

const TONE: Record<string, string> = {
  lime: "text-lime",
  flame: "text-flame",
  ember: "text-ember",
};

export function BoostTicker() {
  const arena = useRelay((s) => s.arena);
  const boosts = useRelay((s) => s.boosts);
  const items = useMemo((): TickerItem[] => {
    if (!isLiveMode()) return tickerItems(arena);
    return boosts.map((b) => ({
      id: b.mirroredRunnerId,
      pre: `${b.boosterHandle ?? "a runner"} boosted`,
      hot: b.runnerName,
      post: b.amount > 0 ? ` · $${b.amount.toFixed(2)}` : "",
      tone: "flame" as const,
    }));
  }, [arena, boosts]);

  if (items.length === 0) return null;
  const doubled = [...items, ...items];

  return (
    <div
      className="flex items-stretch overflow-hidden rounded-xl border-2 border-lined bg-graphite"
      aria-label="Live arena activity"
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2 border-r-2 border-lined bg-graphite px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-flame blink" aria-hidden />
        <span className="mlabel text-flame">LIVE</span>
      </div>
      <div
        className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%_-_28px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%_-_28px),transparent)]"
      >
        <div className="marquee-track flex w-max items-center gap-10 px-4 py-2">
          {doubled.map((it, i) => (
            <span
              key={`${it.id}-${i}`}
              aria-hidden={i >= items.length}
              className="data whitespace-nowrap text-xs"
            >
              <span className="text-foam">{it.pre} </span>
              <span className={cn("font-semibold", TONE[it.tone])}>{it.hot}</span>
              {it.post && <span className="text-foam">{it.post}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
