"use client";

import { create } from "zustand";
import type { AppNotification, AppScreen, Lap, LapResult, LiveLap, RelayView, RunnerConfig } from "../types";
import { isLiveMode } from "../live/mode";
import { getLiveHandlers } from "../live/registry";
import { emptyLiveState } from "./emptyState";
import type { RelayStore } from "./storeTypes";

export type { RelayStore } from "./storeTypes";

let engineTimer: ReturnType<typeof setInterval> | null = null;

export function ensureEngine() {
  if (typeof window === "undefined") return;
  if (isLiveMode()) return;
  if (engineTimer) return;
  void import("./mockEngine").then((m) => {
    m.installMockEngine(useRelay);
  });
}

export function stopEngine() {
  if (engineTimer) {
    clearInterval(engineTimer);
    engineTimer = null;
  }
}

function navHash(view: RelayView, screen: AppScreen): string {
  return view === "landing" ? "#/" : `#/app/${screen}`;
}

export const useRelay = create<RelayStore>((set, get) => ({
  ...emptyLiveState(),

  go: (view, screen) => {
    const s = get();
    const target = view === "app" ? screen ?? s.screen : s.screen;
    if (typeof window !== "undefined") {
      const hash = navHash(view, target);
      if (window.location.hash !== hash) window.location.hash = hash;
    }
    set({ view, screen: target });
    if (view === "landing" && typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  },
  goScreen: (screen) => get().go("app", screen),
  selectRunner: (id) => set({ selectedRunnerId: id, screen: "runner" }),
  syncHash: () => {
    const hash = typeof window === "undefined" ? "#/" : window.location.hash;
    const clean = hash.replace(/^#\/?/, "");
    if (clean === "" || clean === "/") {
      set({ view: "landing" });
      return;
    }
    const parts = clean.split("/").filter(Boolean);
    if (parts[0] === "demo") {
      if (isLiveMode()) {
        set({ view: "app", screen: "home" });
        return;
      }
      set({ view: "app", screen: "home", demo: { ...get().demo, panelOpen: true } });
      return;
    }
    if (parts[0] === "app") {
      const screen = (parts[1] as AppScreen) || "home";
      set({ view: "app", screen });
    }
  },

  setDraftConfig: (patch) => set((s) => ({ draftConfig: { ...s.draftConfig, ...patch } })),
  deployDraft: () => {
    void get().deployDraftAsync();
  },
  deployDraftAsync: async () => {
    const h = getLiveHandlers();
    if (h) {
      await h.deploy();
      return;
    }
    if (!isLiveMode()) {
      const m = await import("./mockEngine");
      m.mockSlice(set, get).deployDraft();
    }
  },
  resetDemo: () => {
    if (isLiveMode()) return;
    void import("./mockEngine").then((m) => m.installMockEngine(useRelay));
  },
  pauseRunner: () => {
    void getLiveHandlers()?.pause();
  },
  resumeRunner: () => {
    void getLiveHandlers()?.resume();
  },
  stopRunner: () => {
    void getLiveHandlers()?.kill();
  },
  withdraw: () => {
    void getLiveHandlers()?.withdraw();
  },

  boostRunner: () => {
    /* production has no synthetic boost accounting */
  },
  toggleFollow: (runnerId) => {
    const s = get();
    const has = s.following.includes(runnerId);
    set({
      following: has ? s.following.filter((f) => f !== runnerId) : [runnerId, ...s.following],
    });
  },

  openResult: () => set({ resultOpen: true, resultSeen: true }),
  dismissResult: () => set({ resultOpen: false }),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearBaton: () => set({ baton: null }),

  demoTogglePanel: (open) => {
    if (isLiveMode()) return;
    set((s) => ({ demo: { ...s.demo, panelOpen: open ?? !s.demo.panelOpen } }));
  },
  demoSetSpeed: (speed) => set((s) => ({ demo: { ...s.demo, speed } })),
  demoForce: (outcome) => set((s) => ({ demo: { ...s.demo, forcedOutcome: outcome } })),
  demoTogglePause: () => set((s) => ({ demo: { ...s.demo, paused: !s.demo.paused } })),
  demoSkip: () => undefined,

  tick: () => undefined,
}));

export function selectPnl(s: { bankroll: number; startBankroll: number; laps: Lap[] }) {
  const realized = +(s.bankroll - s.startBankroll).toFixed(2);
  let b = s.startBankroll;
  let peak = s.startBankroll;
  for (const l of s.laps) {
    b += l.pnl;
    peak = Math.max(peak, b);
  }
  peak = Math.max(peak, s.bankroll);
  return {
    realized,
    today: realized,
    bankroll: s.bankroll,
    startBankroll: s.startBankroll,
    peakBankroll: +peak.toFixed(2),
    drawdown: +(peak - s.bankroll).toFixed(2),
  };
}

export function selectLivePnl(live: LiveLap | null): number {
  if (!live?.position) return 0;
  const mark = live.position.side === "UP" ? live.probUp : 1 - live.probUp;
  return +(live.position.quantity * mark - live.position.stake).toFixed(2);
}

export function selectNextStake(bankroll: number, streak: number, cfg: RunnerConfig): number {
  const next = bankroll * cfg.baseStakePct * (1 + cfg.streakMultiplier * streak);
  return Math.min(next, bankroll * cfg.maxStakePct);
}

export function selectUnread(notifs: AppNotification[]): number {
  return notifs.filter((n) => !n.read).length;
}
