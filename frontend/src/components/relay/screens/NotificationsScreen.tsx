"use client";

/**
 * RELAY — ALERTS.
 * What happened while you lived: fills, settles, streaks, shields and
 * boosts, grouped by how long ago they landed on-chain. Reading a row
 * marks it read locally; the feed itself is pure store state.
 */

import { useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Bell } from "lucide-react";

import { useRelay } from "@/lib/relay/engine/store";
import type { AppNotification } from "@/lib/relay/types";
import { Panel } from "../core/primitives";
import { FlameMark } from "../identity/identity";
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, bucketOf, EmptyFeed, NotificationRow } from "./notifications/kinds";
import type { BucketKey } from "./notifications/kinds";

const BUCKET_ORDER: BucketKey[] = ["recent", "hour", "earlier"];

export function NotificationsScreen() {
  const notifications = useRelay((s) => s.notifications);
  const runner = useRelay((s) => s.runner);
  const lastResult = useRelay((s) => s.lastResult);
  const markAllRead = useRelay((s) => s.markAllRead);
  const openResult = useRelay((s) => s.openResult);
  const goScreen = useRelay((s) => s.goScreen);
  /* minute-granular sim clock — enough for hour buckets, cheap to re-render */
  const minute = useRelay((s) => Math.floor(s.now / 60_000));

  const [localRead, setLocalRead] = useState<ReadonlySet<string>>(() => new Set<string>());

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.at - a.at),
    [notifications]
  );

  const groups = useMemo(() => {
    const now = minute * 60_000;
    const by: Record<BucketKey, AppNotification[]> = {
      recent: [],
      hour: [],
      earlier: [],
    };
    for (const n of sorted) by[bucketOf(n.at, now)].push(n);
    return BUCKET_ORDER.map((key) => ({ key, items: by[key] })).filter(
      (g) => g.items.length > 0
    );
  }, [sorted, minute]);

  const unread = useMemo(
    () => notifications.reduce((acc, n) => (n.read || localRead.has(n.id) ? acc : acc + 1), 0),
    [notifications, localRead]
  );

  const markOneRead = (id: string) =>
    setLocalRead((prev) => (prev.has(id) ? prev : new Set([...prev, id])));

  const handleMarkAll = () => {
    markAllRead();
    setLocalRead(new Set());
  };

  const totalRows = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        {/* ── header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="size-3.5 text-flame" aria-hidden />
              <span className="mlabel text-flame">ALERTS</span>
            </div>
            <h1 className="mt-2 text-3xl font-black wide leading-[0.95] tracking-[-0.01em] sm:text-4xl">
              What happened while you lived.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-foam">
              Fills and settlements — pushed when they are verified.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {unread > 0 && (
              <span
                className="data rounded-md bg-lime px-2 py-1 text-[11px] font-semibold text-graphite"
                aria-label={`${unread} unread alerts`}
              >
                {unread} UNREAD
              </span>
            )}
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unread === 0}
              className="mlabel min-h-[44px] rounded-xl border-2 border-lined px-3.5 py-2.5 text-cream transition-colors hover:border-foam/60 hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:pointer-events-none disabled:opacity-40"
            >
              MARK ALL READ
            </button>
          </div>
        </header>

        {/* ── feed ── */}
        <section className="mt-6" aria-label="Alert feed">
          <Panel label={`ALERT FEED${totalRows > 0 ? ` · ${totalRows} EVENTS` : ""}`}>
            {groups.length === 0 ? (
              <EmptyFeed
                hasRunner={runner != null}
                onDeploy={() => goScreen("deploy")}
                onWatch={() => goScreen("live")}
              />
            ) : (
              <div className="pb-2 pt-1">
                {groups.map((g, gi) => (
                  <div key={g.key}>
                    <div className="flex items-center gap-3 px-4 pb-1 pt-3">
                      <span className="mlabel shrink-0 text-foam">{BUCKET_LABELS[g.key]}</span>
                      <span className="data shrink-0 text-[10px] text-foam/50">
                        {g.items.length}
                      </span>
                      <span className="h-px flex-1 bg-lined" aria-hidden />
                    </div>
                    <ul>
                      {g.items.map((n, ii) => (
                        <NotificationRow
                          key={n.id}
                          n={n}
                          unread={!n.read && !localRead.has(n.id)}
                          canViewResult={
                            (n.kind === "WIN" || n.kind === "LOSS" || n.kind === "VOID") &&
                            n.lap != null &&
                            lastResult != null &&
                            n.lap === lastResult.lap
                          }
                          last={gi === groups.length - 1 && ii === g.items.length - 1}
                          onRead={() => markOneRead(n.id)}
                          onOpenResult={openResult}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-4 pt-3">
                  <FlameMark className="h-3.5 w-3.5" aria-hidden />
                  <span className={cn("mlabel text-foam/50")}>
                    EVERYTHING ABOVE IS DERIVED FROM ON-CHAIN EVENTS
                  </span>
                </div>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </MotionConfig>
  );
}
