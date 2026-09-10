import { DEFAULT_DRAFT, EMPTY_BOOK } from "../config/network";

/**
 * Store fields that belong to one connected owner.
 * Switching wallet (or disconnecting) must drop them so Wallet C
 * cannot inherit Wallet B's tape, result overlay, or alerts.
 */
export function ownerBoundReset() {
  return {
    runner: null,
    vaultAddress: null as string | null,
    backendState: null as string | null,
    backendLastError: null as string | null,
    liveLap: null,
    decision: null,
    laps: [] as never[],
    bankroll: 0,
    peakBankroll: 0,
    startBankroll: 0,
    lastResult: null,
    resultOpen: false,
    resultSeen: true,
    baton: null,
    notifications: [] as [],
    priceHistory: [] as [],
    calendar: [] as [],
    book: EMPTY_BOOK,
    boostIntent: null,
    following: [] as string[],
    streak: {
      current: 0,
      best: 0,
      shields: 0,
      shieldsMax: DEFAULT_DRAFT.shieldsMax,
      nextShield: 0,
      protectedCount: 0,
    },
  };
}
