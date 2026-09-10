"use client";

/**
 * RELAY — the lap feed: a broadcast log of everything the runner did
 * this window. Newest at the bottom, auto-scrolled.
 */

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useRelay } from "@/lib/relay/engine/store";
import { Panel } from "@/components/relay/core/primitives";
import { clock } from "@/lib/relay/format";
import type { LapEvent } from "@/lib/relay/types";
import { eventTone } from "./helpers";

const EMPTY: LapEvent[] = [];

export function EventFeed({ className }: { className?: string }) {
  const events = useRelay((s) => s.liveLap?.events) ?? EMPTY;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [events]);

  return (
    <Panel label="LAP FEED" className={className}>
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto scroll-thin px-5 pt-3 pb-4"
        role="log"
        aria-label="Lap event feed"
        aria-live="polite"
      >
        {events.map((ev) => (
          <FeedRow key={ev.id} ev={ev} />
        ))}
        {events.length === 0 && (
          <div className="mlabel text-foam/60 py-4">WAITING FOR FIRST EVENT…</div>
        )}
      </div>
    </Panel>
  );
}

function FeedRow({ ev }: { ev: LapEvent }) {
  const tone = eventTone(ev.kind);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex items-start gap-3 py-2 border-t border-lined/50 first:border-t-0"
    >
      <span className="data text-[0.7rem] text-foam/70 shrink-0 pt-1">{clock(ev.at)}</span>
      <span
        className="mlabel shrink-0 pt-1 px-1.5 rounded border"
        style={{ color: tone, borderColor: `${tone}55` }}
      >
        {ev.kind}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-cream leading-snug">{ev.label}</p>
        {ev.detail && <p className="text-xs text-foam leading-snug mt-0.5">{ev.detail}</p>}
      </div>
    </motion.div>
  );
}
