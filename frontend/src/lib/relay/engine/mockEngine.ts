/**
 * Isolated mock simulation. Production live store must not statically import this module.
 */
"use client";

import type { StoreApi } from "zustand";
import type {
  AppNotification,
  AppScreen,
  ArenaRunner,
  BoostRelationship,
  DemoState,
  FillRecord,
  Lap,
  LapOutcome,
  LapPhase,
  LapResult,
  LiveLap,
  MarketWindow,
  OrderRecord,
  PnlSnapshot,
  Position,
  RelayView,
  Runner,
  RunnerConfig,
  Side,
  StreakState,
  Wallet,
  BookSnapshot,
  AssetId,
  Outcome,
} from "../types";
import type { RelayStore } from "./storeTypes";
import {
  ARENA,
  BANKROLL,
  BOOSTS,
  BOOT,
  DEPLOYED_AT,
  FOLLOWING,
  LAPS,
  NOTIFICATIONS,
  PNL,
  RUNNER,
  RUNNER_CONFIG,
  STREAK,
  START_BANKROLL,
  USER,
  WALLET,
} from "../mock/dataset";
import {
  buildBook,
  calendarFrom,
  createWindow,
  entryWithEdge,
  PHASE_DURATIONS,
  PHASE_ORDER,
  probUp as probUpModel,
  scriptOutcome,
  stakeFor,
  steer,
  WINDOW_SIM_MS,
} from "./engine";
import { blockFor, marketId, rng, shortId, txHash } from "../mock/id";

/* ── engine singleton ───────────────────────────────────────── */

let engineTimer: ReturnType<typeof setInterval> | null = null;
let tickCounter = 0;

export function startMockTimer(api: StoreApi<RelayStore>) {
  if (engineTimer || typeof window === "undefined") return;
  engineTimer = setInterval(() => {
    const s = api.getState();
    if (!s.demo.paused) s.tick(250);
  }, 250);
}

export function stopMockTimer() {
  if (engineTimer) clearInterval(engineTimer);
  engineTimer = null;
}

/* ── helpers ────────────────────────────────────────────────── */

function copy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

interface BatonState {
  from: number;
  to: number;
  key: number;
}

interface Decision {
  side: Side;
  stake: number;
  entry: number;
}

function pushN(
  notifs: AppNotification[],
  kind: AppNotification["kind"],
  title: string,
  body: string,
  at: number,
  lap?: number
): AppNotification[] {
  return [
    { id: `ntf-${at}-${kind}-${Math.random().toString(36).slice(2, 7)}`, kind, title, body, at, read: false, lap },
    ...notifs,
  ].slice(0, 48);
}

/* ── boot state factory ─────────────────────────────────────── */

function bootLiveLap(now: number): LiveLap {
  // Lap 18 is already mid-flight: window opened 35s ago, position filled.
  const lapNumber = 18;
  const win = createWindow(lapNumber, now - 35_000);
  const price = +steer(win.openPrice, win.openPrice * 1.0012, 0.55).toFixed(
    win.asset === "BTC" ? 1 : 2
  );
  const prob = probUpModel(price, win.openPrice, 0.61);
  const stake = stakeFor(BANKROLL, 7, 0.06, 0.09, 0.1);
  const side: Side = "UP";
  const entry = entryWithEdge(prob, side);
  const quantity = +(stake / entry).toFixed(2);
  const placedAt = win.opensAt + 9_000;
  const latency = 392;
  const order: OrderRecord = {
    id: `ord-${lapNumber}`,
    kind: "POST_ONLY",
    side,
    price: entry,
    quantity,
    stake,
    placedAt,
    status: "FILLED",
    tx: { hash: txHash(`o${lapNumber}`), block: blockFor(`o${lapNumber}`), at: placedAt },
    latencyMs: latency,
  };
  const fill: FillRecord = {
    id: `fil-${lapNumber}`,
    orderId: order.id,
    price: entry,
    quantity,
    filledAt: placedAt + latency,
    tx: { hash: txHash(`f${lapNumber}`), block: blockFor(`o${lapNumber}`) + 1, at: placedAt + latency },
  };
  const position: Position = {
    id: `pos-${lapNumber}`,
    lapNumber,
    marketId: win.marketId,
    side,
    stake,
    entryPrice: entry,
    quantity,
    markPrice: prob,
  };
  return {
    number: lapNumber,
    market: win,
    phase: "HOLD",
    phaseStartedAt: now,
    windowElapsedMs: 35_000,
    windowTotalMs: WINDOW_SIM_MS,
    countdownMs: WINDOW_SIM_MS - 35_000,
    position,
    order,
    fill,
    price,
    probUp: prob,
    events: [
      {
        id: "ev-0",
        at: win.opensAt,
        kind: "SCAN" as const,
        label: "Window discovered",
        detail: `${win.label} · 15m · market 0x${shortId(win.marketId)}`,
      },
      {
        id: "ev-1",
        at: win.opensAt + 4_200,
        kind: "ARMED" as const,
        label: "Decision prepared",
        detail: `Follow the book → UP · stake $${stake.toFixed(2)} · entry ${(entry * 100).toFixed(1)}¢`,
      },
      {
        id: "ev-2",
        at: placedAt,
        kind: "ORDER" as const,
        label: "Order submitted",
        detail: `Post-only bid · ${quantity} contracts @ ${(entry * 100).toFixed(1)}¢`,
      },
      {
        id: "ev-3",
        at: placedAt + latency,
        kind: "FILL" as const,
        label: "Filled — same block",
        detail: `Order→confirm ${latency}ms · 0x${shortId(fill.tx.hash)}`,
      },
    ],
  };
}

function initialState() {
  const now = BOOT;
  const liveLap = bootLiveLap(now);
  return {
    view: "landing" as RelayView,
    screen: "home" as AppScreen,
    selectedRunnerId: null,
    booted: true,

    wallet: copy(WALLET),
    runner: copy(RUNNER),
    config: copy(RUNNER_CONFIG),
    draftConfig: copy(RUNNER_CONFIG),

    laps: copy(LAPS),
    streak: copy(STREAK),
    bankroll: BANKROLL,
    peakBankroll: PNL.peakBankroll,
    startBankroll: START_BANKROLL,

    liveLap,
    decision: null,
    priceHistory: [] as { t: number; p: number }[],
    book: buildBook(liveLap.probUp, 18),
    calendar: calendarFrom(18, liveLap.market, 3),
    latencyMs: 392,

    lastResult: null,
    resultOpen: false,
    resultSeen: true,
    baton: null,

    arena: copy(ARENA),
    boosts: copy(BOOSTS),
    following: [...FOLLOWING],
    notifications: copy(NOTIFICATIONS),

    demo: { panelOpen: false, speed: 1, forcedOutcome: null, paused: false },
    now,
    vaultAddress: null,
    backendState: null,
    apiError: null,
    txPhase: null,
  };
}

/* ── store ──────────────────────────────────────────────────── */

export function mockSlice(set: StoreApi<RelayStore>["setState"], get: StoreApi<RelayStore>["getState"]): RelayStore {
  return {
  ...initialState(),

  /* navigation … */
  go: (view, screen) => {
    const s = get();
    const target = view === "app" ? screen ?? s.screen : s.screen;
    if (typeof window !== "undefined") {
      const hash = view === "landing" ? "#/" : `#/app/${target}`;
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
      set({ view: "app", screen: "home", demo: { ...get().demo, panelOpen: true } });
      return;
    }
    if (parts[0] === "app") {
      const screen = (parts[1] as AppScreen) || "home";
      set({ view: "app", screen });
    }
  },

  /* deploy … */
  setDraftConfig: (patch) =>
    set((s) => ({ draftConfig: { ...s.draftConfig, ...patch } })),
  deployDraft: () => {
    const s = get();
    const cfg = s.draftConfig;
    const now = s.now;
    const runner: Runner = {
      id: "run-nightshift",
      name: "Night Shift",
      ownerId: USER.id,
      ownerHandle: USER.handle,
      status: "DEPLOYING",
      deployedAt: now,
      config: cfg,
      strategy:
        cfg.bias === "FOLLOW"
          ? "Follow the Book · post-only → IOC"
          : `Momentum · ${cfg.bias} · post-only → IOC`,
    };
    const win = createWindow(1, now + 2_600, cfg.cadence);
    const liveLap: LiveLap = {
      number: 1,
      market: win,
      phase: "SCAN",
      phaseStartedAt: now,
      windowElapsedMs: 0,
      windowTotalMs: WINDOW_SIM_MS,
      countdownMs: WINDOW_SIM_MS,
      position: null,
      order: null,
      fill: null,
      price: win.openPrice,
      probUp: 0.5,
      events: [
        {
          id: "ev-deploy-0",
          at: now,
          kind: "SCAN",
          label: "Runner deployed",
          detail: `Vault funded · budget $${cfg.budget.toFixed(2)} · stop-loss $${cfg.stopLoss.toFixed(2)}`,
        },
      ],
    };
    set({
      runner,
      config: cfg,
      laps: [],
      streak: {
        current: 0,
        best: 0,
        shields: 0,
        shieldsMax: cfg.shieldsMax,
        nextShield: 0,
        protectedCount: 0,
      },
      bankroll: cfg.budget,
      startBankroll: cfg.budget,
      peakBankroll: cfg.budget,
      liveLap,
      decision: null,
      priceHistory: [],
      calendar: calendarFrom(1, win, 3),
      lastResult: null,
      resultOpen: false,
      resultSeen: true,
      baton: null,
      view: "app",
      screen: "live",
      notifications: pushN(
        s.notifications,
        "DEPLOY",
        "Night Shift deployed",
        `Budget $${cfg.budget.toFixed(2)} · stop-loss $${cfg.stopLoss.toFixed(2)} · worst case bounded. The runner cannot withdraw your funds.`,
        now
      ),
      arena: s.arena.map((a) =>
        a.isYou
          ? { ...a, pnl7d: 0, pnlLifetime: 0, streak: 0, laps: 0, winRate: 0, spark: [cfg.budget, cfg.budget] }
          : a
      ),
    });
    if (typeof window !== "undefined" && window.location.hash !== "#/app/live") {
      window.location.hash = "#/app/live";
    }
  },
  deployDraftAsync: async () => {
    get().deployDraft();
  },
  resetDemo: () => {
    const fresh = initialState();
    set({
      ...fresh,
      view: "app",
      screen: "home",
      demo: { ...get().demo, panelOpen: true, forcedOutcome: null, paused: false },
    });
  },
  pauseRunner: () => {
    const s = get();
    if (!s.runner) return;
    set({
      runner: { ...s.runner, status: "PAUSED" },
      notifications: pushN(
        s.notifications,
        "INFO",
        "Runner paused",
        "No new laps will start. The open position settles normally, then the runner waits.",
        s.now
      ),
    });
  },
  resumeRunner: () => {
    const s = get();
    if (!s.runner) return;
    set({ runner: { ...s.runner, status: "RUNNING" } });
  },
  stopRunner: () => {
    const s = get();
    if (!s.runner) return;
    set({
      runner: { ...s.runner, status: "STOPPED" },
      liveLap: null,
      notifications: pushN(
        s.notifications,
        "ARENA",
        "Runner killed",
        "Operator revoked. Orders self-expire. Your bankroll stays withdrawable — always.",
        s.now
      ),
    });
  },
  withdraw: () => {
    const s = get();
    if (!s.runner || s.bankroll <= 0) return;
    set({
      wallet: { ...s.wallet, tUSDC: +(s.wallet.tUSDC + s.bankroll).toFixed(2) },
      bankroll: 0,
      runner: { ...s.runner, status: "STOPPED" },
      liveLap: null,
      notifications: pushN(
        s.notifications,
        "CLAIM",
        `Bankroll withdrawn — $${s.bankroll.toFixed(2)}`,
        "tUSDC returned to your wallet. Withdrawals are user-only; no one else can ever move them.",
        s.now
      ),
    });
  },

  chargeShields: () => {
    const s = get();
    const n = s.draftConfig.shieldsMax;
    set({
      streak: { ...s.streak, shieldsMax: n, shields: Math.max(s.streak.shields, n) },
      config: { ...s.config, shieldsMax: n },
    });
  },

  authorizeRedeem: () => undefined,

  /* social … */
  boostRunner: (runnerId, amount) => {
    const s = get();
    const target = s.arena.find((a) => a.runnerId === runnerId);
    if (!target || s.wallet.tUSDC < amount) return;
    set({
      wallet: { ...s.wallet, tUSDC: +(s.wallet.tUSDC - amount).toFixed(2) },
      arena: s.arena.map((a) =>
        a.runnerId === runnerId ? { ...a, boosters: a.boosters + 1 } : a
      ),
      boosts: [
        {
          runnerId,
          runnerName: target.name,
          amount,
          boostedAt: s.now,
          mirroredRunnerId: `run-mirror-${shortId(runnerId)}`,
        },
        ...s.boosts,
      ],
      notifications: pushN(
        s.notifications,
        "BOOST",
        `You boosted ${target.name}`,
        `$${amount.toFixed(2)} mirrored onto their config. You now earn their exact lap results.`,
        s.now
      ),
    });
  },
  toggleFollow: (runnerId) => {
    const s = get();
    const has = s.following.includes(runnerId);
    set({
      following: has ? s.following.filter((f) => f !== runnerId) : [runnerId, ...s.following],
      arena: s.arena.map((a) =>
        a.runnerId === runnerId
          ? { ...a, followers: Math.max(0, a.followers + (has ? -1 : 1)) }
          : a
      ),
    });
  },

  /* moments … */
  openResult: () => set({ resultOpen: true, resultSeen: true }),
  dismissResult: () => set({ resultOpen: false }),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearBaton: () => set({ baton: null }),

  /* demo … */
  demoTogglePanel: (open) =>
    set((s) => ({ demo: { ...s.demo, panelOpen: open ?? !s.demo.panelOpen } })),
  demoSetSpeed: (speed) => set((s) => ({ demo: { ...s.demo, speed } })),
  demoForce: (outcome) => set((s) => ({ demo: { ...s.demo, forcedOutcome: outcome } })),
  demoTogglePause: () => set((s) => ({ demo: { ...s.demo, paused: !s.demo.paused } })),
  demoSkip: () => {
    const s = get();
    const lap = s.liveLap;
    if (!lap) return;
    if (lap.phase === "HOLD" || lap.phase === "CLOSING") {
      const dur = PHASE_DURATIONS[lap.phase];
      set({ liveLap: { ...lap, phaseStartedAt: lap.phaseStartedAt - (dur - 200) } });
    }
  },

  /* ── the engine tick ─────────────────────────────────────── */
  tick: (realDtMs) => {
    const s = get();
    const dt = realDtMs * s.demo.speed;
    const now = s.now + dt;
    tickCounter += 1;

    /* deploying → running */
    if (s.runner?.status === "DEPLOYING" && now > s.runner.deployedAt + 2_400) {
      set({ runner: { ...s.runner, status: "RUNNING" }, now });
      return;
    }

    const runner = s.runner;
    if (!runner || !s.liveLap) {
      set({ now });
      return;
    }
    // STOPPED kills instantly; PAUSED/PARKED finish the open lap, then wait.
    if (runner.status === "STOPPED" || runner.status === "DEPLOYING") {
      set({ now });
      return;
    }

    const lap = s.liveLap;
    const phase = lap.phase;
    const phaseElapsed = now - lap.phaseStartedAt;
    const windowElapsed = Math.min(Math.max(0, now - lap.market.opensAt), WINDOW_SIM_MS);
    const remainingFrac = Math.max(0, 1 - windowElapsed / WINDOW_SIM_MS);

    /* ── REARM completion → next lap ── */
    if (phase === "REARM" && phaseElapsed >= PHASE_DURATIONS.REARM) {
      if (runner.status === "RUNNING") {
        const nextNumber = lap.number + 1;
        const win = createWindow(nextNumber, now + 400, s.config.cadence);
        const nextLap: LiveLap = {
          number: nextNumber,
          market: win,
          phase: "SCAN",
          phaseStartedAt: now,
          windowElapsedMs: 0,
          windowTotalMs: WINDOW_SIM_MS,
          countdownMs: WINDOW_SIM_MS,
          position: null,
          order: null,
          fill: null,
          price: win.openPrice,
          probUp: 0.5,
          events: [
            {
              id: `ev-${nextNumber}-0`,
              at: now,
              kind: "SCAN",
              label: "Next window discovered",
              detail: `${win.label} · 15m · market 0x${shortId(win.marketId)}`,
            },
          ],
        };
        set({
          now,
          liveLap: nextLap,
          decision: null,
          priceHistory: [],
          calendar: calendarFrom(nextNumber, win, 3),
          baton: null,
        });
      } else {
        set({
          now,
          liveLap: null,
          baton: null,
          notifications: pushN(
            s.notifications,
            "INFO",
            "Runner waiting",
            `${runner.name} is ${runner.status.toLowerCase()} — no new laps will start until you resume.`,
            now
          ),
        });
      }
      return;
    }

    /* ── price walk ── */
    let price = lap.price;
    if (phase === "ARMED" || phase === "FILL" || phase === "HOLD" || phase === "CLOSING") {
      const jitter = rng(tickCounter * 31 + lap.number);
      const vol = lap.market.asset === "BTC" ? 0.00017 : 0.00024;
      const step = (jitter() - 0.5) * vol * Math.min(dt / 250, 2);
      price = price * (1 + step);
      if (phase === "CLOSING" && lap.position) {
        const { target } = closingTarget(lap, s.streak.current, s.demo.forcedOutcome);
        price = steer(price, target, 0.1);
      }
      if (phase === "HOLD" || phase === "CLOSING") {
        price = +price.toFixed(lap.market.asset === "BTC" ? 1 : 2);
      }
    }
    const prob = probUpModel(price, lap.market.openPrice, remainingFrac);
    const book = buildBook(prob, tickCounter + lap.number * 977);
    const priceHistory =
      phase === "HOLD" || phase === "CLOSING"
        ? [...s.priceHistory, { t: now, p: price }].slice(-320)
        : s.priceHistory;

    const updatedLap: LiveLap = {
      ...lap,
      price,
      probUp: prob,
      windowElapsedMs: windowElapsed,
      countdownMs: Math.max(0, WINDOW_SIM_MS - windowElapsed),
      position: lap.position
        ? { ...lap.position, markPrice: lap.position.side === "UP" ? prob : 1 - prob }
        : lap.position,
    };

    /* ── phase transitions ── */
    if (phaseElapsed >= PHASE_DURATIONS[phase] && phase !== "REARM") {
      const idx = PHASE_ORDER.indexOf(phase);
      const next = PHASE_ORDER[idx + 1] as LapPhase | undefined;
      if (next) {
        const patch = advancePhase(s, updatedLap, next, now);
        set({ ...(patch as Partial<RelayStore>), now, book, priceHistory });
        return;
      }
    }

    set({ now, book, priceHistory, liveLap: updatedLap });
  },
  };
}

export function installMockEngine(api: StoreApi<RelayStore>) {
  api.setState(mockSlice(api.setState, api.getState), true);
  startMockTimer(api);
}

/* ── phase transition machine ───────────────────────────────── */

function closingTarget(
  lap: LiveLap,
  streak: number,
  forced: "win" | "loss" | "void" | null
) {
  const script = scriptOutcome(lap.number, forced, streak);
  const side = lap.position?.side ?? "UP";
  const mag = Math.abs(script.targetFactor - 1);
  const factor = script.isVoid
    ? 1.00005
    : script.win
      ? side === "UP"
        ? 1 + mag
        : 1 - mag
      : side === "UP"
        ? 1 - mag
        : 1 + mag;
  return { script, target: lap.market.openPrice * factor };
}

function pushEvent(
  lap: LiveLap,
  at: number,
  kind: LapPhase,
  label: string,
  detail?: string
) {
  return [
    ...lap.events,
    { id: `ev-${lap.number}-${at}`, at, kind, label, detail },
  ].slice(-40);
}

function advancePhase(
  s: RelayStore,
  lap: LiveLap,
  next: LapPhase,
  now: number
): Partial<RelayStore> {
  const { streak, bankroll, laps, arena, notifications } = s;
  const cfg = s.config;
  const market = lap.market;

  switch (next) {
    case "ARMED": {
      const drift = lap.price >= market.openPrice;
      const side: Side =
        cfg.bias === "UP" ? "UP" : cfg.bias === "DOWN" ? "DOWN" : drift ? "UP" : "DOWN";
      const stake = stakeFor(
        bankroll,
        streak.current,
        cfg.baseStakePct,
        cfg.streakMultiplier,
        cfg.maxStakePct
      );
      const entry = entryWithEdge(lap.probUp, side);
      return {
        decision: { side, stake, entry },
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          events: pushEvent(
            lap,
            now,
            next,
            "Decision prepared",
            `${cfg.bias === "FOLLOW" ? "Follow the book" : `Momentum · ${cfg.bias}`} → ${side} · stake $${stake.toFixed(2)} · entry ${(entry * 100).toFixed(1)}¢`
          ),
        },
      };
    }

    case "ORDER": {
      const decision = s.decision ?? {
        side: "UP" as Side,
        stake: stakeFor(bankroll, streak.current, cfg.baseStakePct, cfg.streakMultiplier, cfg.maxStakePct),
        entry: entryWithEdge(lap.probUp, "UP"),
      };
      const quantity = +(decision.stake / decision.entry).toFixed(2);
      const latency = 296 + Math.floor(rng(lap.number * 349)() * 320);
      const order: OrderRecord = {
        id: `ord-${lap.number}`,
        kind: "POST_ONLY",
        side: decision.side,
        price: decision.entry,
        quantity,
        stake: decision.stake,
        placedAt: now,
        status: "PLACED",
        tx: { hash: txHash(`o${lap.number}`), block: blockFor(`o${lap.number}`), at: now },
        latencyMs: latency,
      };
      return {
        latencyMs: latency,
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          order,
          events: pushEvent(
            lap,
            now,
            next,
            "Order submitted",
            `Post-only bid · ${quantity} contracts @ ${(decision.entry * 100).toFixed(1)}¢ · 0x${shortId(order.tx.hash)}`
          ),
        },
      };
    }

    case "FILL": {
      const order = lap.order!;
      const fill: FillRecord = {
        id: `fil-${lap.number}`,
        orderId: order.id,
        price: order.price,
        quantity: order.quantity,
        filledAt: now,
        tx: { hash: txHash(`f${lap.number}`), block: order.tx.block + 1, at: now },
      };
      const position: Position = {
        id: `pos-${lap.number}`,
        lapNumber: lap.number,
        marketId: market.marketId,
        side: order.side,
        stake: order.stake,
        entryPrice: order.price,
        quantity: order.quantity,
        markPrice: order.side === "UP" ? lap.probUp : 1 - lap.probUp,
      };
      return {
        decision: null,
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          order: { ...order, status: "FILLED" },
          fill,
          position,
          events: pushEvent(
            lap,
            now,
            next,
            "Filled — same block",
            `Order→confirm ${order.latencyMs}ms · 0x${shortId(fill.tx.hash)}`
          ),
        },
        notifications: pushN(
          notifications,
          "FILL",
          `Order filled · ${market.asset} 15m @ ${(order.price * 100).toFixed(1)}¢`,
          `${order.stake.toFixed(2)} tUSDC in · ${order.quantity} contracts · order→confirm ${order.latencyMs}ms · same block.`,
          now,
          lap.number
        ),
      };
    }

    case "HOLD":
      return {
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          events: pushEvent(
            lap,
            now,
            next,
            "Holding to settlement",
            "Position resting. Oracle answer scheduled at window close."
          ),
        },
      };

    case "CLOSING":
      return {
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          events: pushEvent(
            lap,
            now,
            next,
            "Window closing",
            "Final stretch — no further entries (headroom gate)."
          ),
        },
      };

    case "ORACLE":
      return {
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          windowElapsedMs: WINDOW_SIM_MS,
          countdownMs: 0,
          events: pushEvent(
            lap,
            now,
            next,
            "Window expired — awaiting oracle",
            "AnswerDelivered inbound via Somnia Reactivity."
          ),
        },
      };

    case "RESULT": {
      const script = closingScript(lap, streak.current, s.demo.forcedOutcome);
      const position = lap.position!;
      const side = position.side;
      const marketOutcome: Outcome = script.isVoid
        ? "VOID"
        : script.win
          ? side
          : side === "UP"
            ? "DOWN"
            : "UP";
      const lapOutcome: LapOutcome = script.isVoid
        ? "VOID"
        : script.win
          ? "WIN"
          : "LOSS";
      const pnl =
        lapOutcome === "VOID"
          ? 0
          : lapOutcome === "WIN"
            ? +(position.quantity * (1 - position.entryPrice)).toFixed(2)
            : -position.stake;

      const shielded = lapOutcome === "LOSS" && streak.shields > 0;
      const streakBefore = streak.current;
      let streakAfter = streak.current;
      let shields = streak.shields;
      let nextShield = streak.nextShield;
      let protectedCount = streak.protectedCount;
      if (lapOutcome === "WIN") {
        streakAfter = streakBefore + 1;
        nextShield = Math.min(1, nextShield + 0.12);
        if (nextShield >= 1 && shields < streak.shieldsMax) {
          shields += 1;
          nextShield = 0;
        }
      } else if (lapOutcome === "LOSS") {
        if (shields > 0) {
          shields -= 1;
          protectedCount += 1;
          streakAfter = streakBefore; // preserved
        } else {
          streakAfter = 0;
        }
      }

      const mag = Math.abs(script.targetFactor - 1);
      const closePrice = +(
        script.isVoid
          ? market.openPrice * 1.00005
          : marketOutcome === "UP"
            ? market.openPrice * (1 + mag)
            : market.openPrice * (1 - mag)
      ).toFixed(market.asset === "BTC" ? 1 : 2);

      const bankrollBefore = bankroll;
      const bankrollAfter = +(bankroll + pnl).toFixed(2);

      const settledLap: Lap = {
        number: lap.number,
        market: {
          asset: market.asset,
          label: market.label,
          marketId: market.marketId,
          windowStart: market.opensAt,
          windowEnd: market.closesAt,
          openPrice: market.openPrice,
          closePrice,
          cadence: market.cadence,
        },
        side,
        stake: position.stake,
        entryPrice: position.entryPrice,
        outcome: lapOutcome,
        marketOutcome,
        pnl,
        streakAfter,
        shielded,
        settledAt: now,
        order: lap.order!,
        fill: lap.fill!,
        proof: {
          marketId: market.marketId,
          lap: lap.number,
          fillTx: lap.fill!.tx.hash,
          settlementTx: txHash(`s${lap.number}`),
          claimTx: txHash(lapOutcome === "VOID" ? `v${lap.number}` : `c${lap.number}`),
          oracleQuestionId: marketId(`q${lap.number}`),
          status: "VERIFIED",
          sealedAt: now + 900,
        },
      };

      /* notifications */
      let notifs = notifications;
      const sign = pnl > 0 ? "+" : pnl < 0 ? "−" : "";
      notifs = pushN(
        notifs,
        lapOutcome === "VOID" ? "VOID" : lapOutcome === "WIN" ? "WIN" : "LOSS",
        `Lap ${lap.number} ${lapOutcome === "VOID" ? "voided — stake returned" : lapOutcome === "WIN" ? "complete" : "resolved against you"}${pnl !== 0 ? ` — ${sign}$${Math.abs(pnl).toFixed(2)}` : ""}`,
        lapOutcome === "VOID"
          ? `Oracle returned 0.5/0.5. A refund is not a loss: streak preserved, $${position.stake.toFixed(2)} returned.`
          : `${market.asset} closed ${marketOutcome === "UP" ? "above" : "below"} the strike. Streak ×${streakAfter} · bankroll $${bankrollAfter.toFixed(2)}.`,
        now,
        lap.number
      );
      if (shielded) {
        notifs = pushN(
          notifs,
          "SHIELD",
          `Shield consumed at lap ${lap.number}`,
          "The window resolved against you — your shield ate the loss and the streak survived. Tithe resumed.",
          now,
          lap.number
        );
      }
      if (lapOutcome === "WIN" && streakAfter > 0 && streakAfter % 5 === 0) {
        notifs = pushN(
          notifs,
          "STREAK",
          `Streak ×${streakAfter} — compounding`,
          `Stake size scales with the streak. Next lap risks $${stakeFor(bankrollAfter, streakAfter, cfg.baseStakePct, cfg.streakMultiplier, cfg.maxStakePct).toFixed(2)}.`,
          now,
          lap.number
        );
      }

      /* arena update */
      const youPnl7d = +((arena.find((a) => a.isYou)?.pnl7d ?? 0) + pnl).toFixed(2);
      const drifted = arena.map((a, i) => {
        if (a.isYou) {
          return {
            ...a,
            pnl7d: youPnl7d,
            pnlLifetime: +(a.pnlLifetime + pnl).toFixed(2),
            streak: streakAfter,
            bestStreak: Math.max(a.bestStreak, streakAfter),
            laps: a.laps + 1,
            winRate: (a.laps * a.winRate + (lapOutcome === "WIN" ? 1 : 0)) / (a.laps + 1),
            spark: [...a.spark.slice(1), bankrollAfter],
            status: "RUNNING" as const,
          };
        }
        const r = rng(lap.number * 131 + i * 17);
        return { ...a, pnl7d: +(a.pnl7d + (r() - 0.46) * 3.2).toFixed(2) };
      });
      const preRanks = new Map(drifted.map((a) => [a.runnerId, a.rank]));
      drifted.sort((a, b) => b.pnl7d - a.pnl7d);
      const withRanks: ArenaRunner[] = drifted.map((a) => ({ ...a }));
      withRanks.forEach((a, i) => {
        a.rank = i + 1;
        a.delta = (preRanks.get(a.runnerId) ?? a.rank) - a.rank;
      });
      const youBefore = preRanks.get("run-nightshift");
      const youNow = withRanks.find((a) => a.isYou)?.rank;
      if (youNow != null && youBefore != null && youNow !== youBefore) {
        notifs = pushN(
          notifs,
          "ARENA",
          `Night Shift is now #${youNow}`,
          `Rank ${youNow < youBefore ? "up" : "down"} after lap ${lap.number}. Every number is derived from verified fills.`,
          now,
          lap.number
        );
      }

      const result: LapResult = {
        lap: lap.number,
        outcome: lapOutcome,
        side,
        asset: market.asset,
        stake: position.stake,
        entryPrice: position.entryPrice,
        closePrice,
        openPrice: market.openPrice,
        pnl,
        streakBefore,
        streakAfter,
        shieldUsed: shielded,
        bankrollBefore,
        bankrollAfter,
        nextMarket: s.calendar[0] ?? null,
        proof: settledLap.proof,
        at: now,
      };

      const stopHit = s.startBankroll - bankrollAfter >= cfg.stopLoss;

      return {
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          events: pushEvent(
            lap,
            now,
            next,
            lapOutcome === "VOID"
              ? "Void — stake returned"
              : `${lapOutcome} — ${sign}$${Math.abs(pnl).toFixed(2)}`,
            script.isVoid
              ? "Oracle returned 0.5/0.5 · streak preserved"
              : `${market.asset} closed ${closePrice > market.openPrice ? "above" : "below"} ${market.openPrice}`
          ),
        },
        laps: [...laps, settledLap],
        streak: {
          ...streak,
          current: streakAfter,
          best: Math.max(streak.best, streakAfter),
          shields,
          nextShield,
          protectedCount,
        },
        bankroll: bankrollAfter,
        peakBankroll: Math.max(s.peakBankroll, bankrollAfter),
        lastResult: result,
        resultSeen: false,
        resultOpen: ["live", "home", "result"].includes(s.screen),
        notifications: notifs,
        arena: withRanks,
        runner: s.runner
          ? { ...s.runner, status: stopHit ? "PARKED" : s.runner.status }
          : s.runner,
      };
    }

    case "CLAIM": {
      const result = s.lastResult;
      return {
        liveLap: {
          ...lap,
          phase: next,
          phaseStartedAt: now,
          events: pushEvent(
            lap,
            now,
            next,
            result && result.outcome !== "VOID"
              ? "Winnings claimed — 0 clicks"
              : "Stake returned — 0 clicks",
            "Reactivity delivered the answer and settled in the same flow."
          ),
        },
        notifications: pushN(
          notifications,
          "CLAIM",
          "Winnings claimed — no button pressed",
          "Somnia Reactivity delivered the oracle answer and settled this lap in the same flow. 0 manual calls.",
          now,
          lap.number
        ),
      };
    }

    case "REARM":
      return {
        liveLap: { ...lap, phase: next, phaseStartedAt: now },
        baton: { from: lap.number, to: lap.number + 1, key: lap.number },
      };
  }

  return {};
}

function closingScript(
  lap: LiveLap,
  streak: number,
  forced: "win" | "loss" | "void" | null
) {
  return scriptOutcome(lap.number, forced, streak);
}

/* ── selectors (pure, reusable by any screen) ───────────────── */

export function selectPnl(s: {
  bankroll: number;
  startBankroll: number;
  laps: Lap[];
}): PnlSnapshot {
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

export function selectNextStake(
  bankroll: number,
  streak: number,
  cfg: RunnerConfig
): number {
  return stakeFor(bankroll, streak, cfg.baseStakePct, cfg.streakMultiplier, cfg.maxStakePct);
}

export function selectUnread(notifs: AppNotification[]): number {
  return notifs.filter((n) => !n.read).length;
}

export const DEMO_BOOT = BOOT;
export const DEMO_DEPLOYED_AT = DEPLOYED_AT;
