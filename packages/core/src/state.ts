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
  DISCOVERING: ["PREPARING", "PAUSED", "STOPPED", "KILLED", "ERROR"],
  PREPARING: ["ORDER_SUBMITTED", "PAUSED", "STOPPED", "KILLED", "ERROR"],
  ORDER_SUBMITTED: ["PARTIAL_FILL", "FILLED", "DISCOVERING", "WAITING_SETTLEMENT", "PAUSED", "ERROR"],
  PARTIAL_FILL: ["FILLED", "WAITING_SETTLEMENT", "REARMING", "PAUSED", "ERROR"],
  FILLED: ["WAITING_SETTLEMENT", "REARMING", "PAUSED", "ERROR"],
  WAITING_SETTLEMENT: ["SETTLED_WIN", "SETTLED_LOSS", "SETTLED_VOID", "REARMING", "PAUSED", "ERROR"],
  SETTLED_WIN: ["REDEEMING", "REARMING", "PAUSED", "ERROR"],
  SETTLED_LOSS: ["REARMING", "STOPPED", "PAUSED", "ERROR"],
  SETTLED_VOID: ["REDEEMING", "REARMING", "PAUSED", "ERROR"],
  REDEEMING: ["REDEEMED", "REARMING", "PAUSED", "ERROR"],
  REDEEMED: ["REARMING", "STOPPED", "PAUSED", "ERROR"],
  REARMING: ["DISCOVERING", "STOPPED", "PAUSED", "KILLED", "ERROR"],
  STOPPED: ["ACTIVE", "KILLED"],
  KILLED: [],
  ERROR: ["DISCOVERING", "STOPPED", "PAUSED", "KILLED"],
  PAUSED: ["ACTIVE", "STOPPED", "KILLED"],
};

export function canTransition(from: RunnerState, to: RunnerState): boolean {
  if (from === to) return true;
  if (to === "KILLED") return true;
  return allowed[from]?.includes(to) ?? false;
}

/** Shortest legal hop list from `from` to `to`, not including `from`. */
export function shortestPath(from: RunnerState, to: RunnerState): RunnerState[] {
  if (from === to) return [];
  const seen = new Set<RunnerState>([from]);
  const prev = new Map<RunnerState, RunnerState>();
  const queue: RunnerState[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nxt of RUNNER_STATES) {
      if (seen.has(nxt) || !canTransition(cur, nxt)) continue;
      seen.add(nxt);
      prev.set(nxt, cur);
      if (nxt === to) {
        const path: RunnerState[] = [];
        let p: RunnerState | undefined = to;
        while (p && p !== from) {
          path.unshift(p);
          p = prev.get(p);
        }
        return path;
      }
      queue.push(nxt);
    }
  }
  throw new Error(`no runner path ${from} -> ${to}`);
}

export function assertTransition(from: RunnerState, to: RunnerState): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal runner transition ${from} -> ${to}`);
  }
}
