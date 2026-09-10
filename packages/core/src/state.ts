export const RUNNER_STATES = [
  "CREATED",
  "FUNDED",
  "ACTIVE",
  "DISCOVERING",
  "PREPARING",
  "ORDER_SUBMITTED",
  "PARTIAL_FILL",
  "FILLED",
  "WAITING_SETTLEMENT",
  "SETTLED_WIN",
  "SETTLED_LOSS",
  "SETTLED_VOID",
  "REDEEMING",
  "REDEEMED",
  "REARMING",
  "STOPPED",
  "KILLED",
  "ERROR",
  "PAUSED",
] as const;

export type RunnerState = (typeof RUNNER_STATES)[number];

const allowed: Record<RunnerState, readonly RunnerState[]> = {
  CREATED: ["FUNDED", "KILLED", "ERROR"],
  FUNDED: ["ACTIVE", "KILLED", "ERROR"],
  ACTIVE: ["DISCOVERING", "PAUSED", "STOPPED", "KILLED", "ERROR"],
  DISCOVERING: ["PREPARING", "STOPPED", "KILLED", "ERROR"],
  PREPARING: ["ORDER_SUBMITTED", "STOPPED", "KILLED", "ERROR"],
  ORDER_SUBMITTED: ["PARTIAL_FILL", "FILLED", "DISCOVERING", "WAITING_SETTLEMENT", "ERROR"],
  PARTIAL_FILL: ["FILLED", "WAITING_SETTLEMENT", "ERROR"],
  FILLED: ["WAITING_SETTLEMENT", "ERROR"],
  WAITING_SETTLEMENT: ["SETTLED_WIN", "SETTLED_LOSS", "SETTLED_VOID", "ERROR"],
  SETTLED_WIN: ["REDEEMING", "ERROR"],
  SETTLED_LOSS: ["REARMING", "STOPPED", "ERROR"],
  SETTLED_VOID: ["REDEEMING", "REARMING", "ERROR"],
  REDEEMING: ["REDEEMED", "ERROR"],
  REDEEMED: ["REARMING", "STOPPED", "ERROR"],
  REARMING: ["DISCOVERING", "STOPPED", "KILLED", "ERROR"],
  STOPPED: ["ACTIVE", "KILLED"],
  KILLED: [],
  ERROR: ["DISCOVERING", "STOPPED", "KILLED"],
  PAUSED: ["ACTIVE", "STOPPED", "KILLED"],
};

export function canTransition(from: RunnerState, to: RunnerState): boolean {
  if (from === to) return true;
  return allowed[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunnerState, to: RunnerState): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal runner transition ${from} -> ${to}`);
  }
}
