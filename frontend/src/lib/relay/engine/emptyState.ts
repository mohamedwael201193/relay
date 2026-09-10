import type { RelayStore } from "./storeTypes";
import { DEFAULT_DRAFT, DISCONNECTED_WALLET, EMPTY_BOOK } from "../config/network";

export function emptyLiveState(): Omit<
  RelayStore,
  | "go"
  | "goScreen"
  | "selectRunner"
  | "syncHash"
  | "setDraftConfig"
  | "deployDraft"
  | "deployDraftAsync"
  | "resetDemo"
  | "pauseRunner"
  | "resumeRunner"
  | "stopRunner"
  | "withdraw"
  | "chargeShields"
  | "authorizeRedeem"
  | "boostRunner"
  | "toggleFollow"
  | "openResult"
  | "dismissResult"
  | "markAllRead"
  | "clearBaton"
  | "demoTogglePanel"
  | "demoSetSpeed"
  | "demoForce"
  | "demoTogglePause"
  | "demoSkip"
  | "tick"
> {
  return {
    view: "landing",
    screen: "home",
    selectedRunnerId: null,
    booted: true,
    wallet: { ...DISCONNECTED_WALLET },
    runner: null,
    config: { ...DEFAULT_DRAFT },
    draftConfig: { ...DEFAULT_DRAFT },
    laps: [],
    streak: {
      current: 0,
      best: 0,
      shields: 0,
      shieldsMax: DEFAULT_DRAFT.shieldsMax,
      nextShield: 0,
      protectedCount: 0,
    },
    bankroll: 0,
    peakBankroll: 0,
    startBankroll: 0,
    liveLap: null,
    decision: null,
    priceHistory: [],
    book: EMPTY_BOOK,
    calendar: [],
    latencyMs: 0,
    lastResult: null,
    resultOpen: false,
    resultSeen: true,
    baton: null,
    arena: [],
    boosts: [],
    following: [],
    notifications: [],
    demo: { panelOpen: false, speed: 1, forcedOutcome: null, paused: false },
    now: Date.now(),
    vaultAddress: null,
    backendState: null,
    apiError: null,
    txPhase: null,
    boostIntent: null,
  };
}
