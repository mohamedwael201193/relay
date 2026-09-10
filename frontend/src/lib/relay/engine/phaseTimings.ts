import type { LapPhase } from "../types";

/** Visual gate timings for the designed Live Lap track. Not a source of financial state. */
export const PHASE_DURATIONS: Record<LapPhase, number> = {
  SCAN: 4000,
  ARMED: 5000,
  ORDER: 3500,
  FILL: 4000,
  HOLD: 44000,
  CLOSING: 8000,
  ORACLE: 4500,
  RESULT: 6000,
  CLAIM: 3500,
  REARM: 2600,
};

export const WINDOW_SIM_MS = 90_000;
export const ENTRY_ZONE_MS = 16_500;
export const CLOSING_FRACTION = 0.12;
