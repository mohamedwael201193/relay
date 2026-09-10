import { publicEnv } from "../config/network";
import { normalizeNetwork, type NetworkConfig } from "./normalizeNetwork";

export type { NetworkConfig };

export class RelayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "RelayApiError";
  }
}

export type RunnerRow = {
  id: string;
  vault: string;
  owner: string;
  operator: string;
  state: string;
  chain_id: number;
  last_error: string | null;
  last_market_id: string | null;
  lap_index: number;
};

type OwnerAuth = { timestamp: number; signature: string; owner?: string };

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20_000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const requestId = crypto.randomUUID();
  try {
    const res = await fetch(`${publicEnv().apiUrl}${path}`, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-relay-request-id": requestId,
        ...(rest.headers ?? {}),
      },
    });
    const rid = res.headers.get("x-relay-request-id") ?? requestId;
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 200) };
      }
    }
    if (!res.ok) {
      const err =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : `relay_api_${res.status}`;
      throw new RelayApiError(err, res.status, body, rid);
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}

export const relayApi = {
  health: () => request<{ ok: boolean; chainId: number; db: boolean; worker: boolean }>("/health"),
  network: async () => normalizeNetwork((await request<Record<string, unknown>>("/v1/network")) ?? {}),
  markets: () => request<{ generatedAt: string; count: number; rows: LiveMarketRow[] }>("/v1/markets/live", { timeoutMs: 45_000 }),
  arena: () => request<{ runners: ArenaRow[] }>("/v1/arena"),
  runnersByOwner: (owner: string) =>
    request<{ runners: RunnerRow[] }>(`/v1/runners?owner=${encodeURIComponent(owner)}`),
  runner: (vault: string) => request<RunnerRow>(`/v1/runners/${vault}`),
  live: (vault: string) =>
    request<{
      id: string;
      vault: string;
      owner: string;
      state: string;
      lastMarketId: string | null;
      lastError: string | null;
      lapIndex: number;
      nextAction: string;
    }>(`/v1/runners/${vault}/live`),
  history: (vault: string) => request<{ runner: RunnerRow; laps: HistoryLap[] }>(`/v1/runners/${vault}/history`),
  proof: (vault: string) => request<{ runner: RunnerRow; proof: ProofBundle }>(`/v1/runners/${vault}/proof`),
  register: (vault: string, auth: OwnerAuth) =>
    request<{ runner: RunnerRow }>("/v1/runners", { method: "POST", body: JSON.stringify({ vault, ...auth }) }),
  provision: (auth: OwnerAuth & { budget: number; stopLoss: number }) =>
    request<{ runner: RunnerRow; deployTx: string; vault: string }>("/v1/runners/provision", {
      method: "POST",
      body: JSON.stringify(auth),
      timeoutMs: 180_000,
    }),
  start: (vault: string, auth: OwnerAuth) =>
    request<{ ok: true; state: string }>(`/v1/runners/${vault}/start`, {
      method: "POST",
      body: JSON.stringify(auth),
    }),
  pause: (vault: string, auth: OwnerAuth) =>
    request<{ ok: true; state: string }>(`/v1/runners/${vault}/pause`, {
      method: "POST",
      body: JSON.stringify(auth),
    }),
  resume: (vault: string, auth: OwnerAuth) =>
    request<{ ok: true; state: string }>(`/v1/runners/${vault}/resume`, {
      method: "POST",
      body: JSON.stringify(auth),
    }),
  stop: (vault: string, auth: OwnerAuth) =>
    request<{ ok: true; state: string }>(`/v1/runners/${vault}/stop`, {
      method: "POST",
      body: JSON.stringify(auth),
    }),
};

export type LiveMarketRow = {
  marketId: string;
  asset?: string;
  intervalSec?: string;
  expiry?: string;
  onchainStatus: string;
  pool: string;
};

export type ArenaRow = {
  vault: string;
  owner: string;
  state: string;
  verified_laps: string | number;
};

export type HistoryLap = {
  id: string;
  lap_index: number;
  market_id: string;
  pool: string | null;
  state: string;
  correlation_id: string | null;
  created_at: string;
  asset?: string | null;
  interval_sec?: string | null;
};

export type ProofBundle = {
  orders: Array<{
    tx_hash: string;
    fill_class: string;
    filled: string;
    market_id: string;
    lap_index: number;
    created_at: string;
    price?: string;
    quantity?: string;
  }>;
  settlements: Array<{
    market_id: string;
    resolved: boolean;
    voided: boolean;
    redeem_tx: string | null;
    lap_index: number;
    created_at: string;
  }>;
  records: Array<{ kind: string; tx_hash: string | null; fill_class: string | null; created_at: string }>;
};

export function eventsUrl(): string {
  return `${publicEnv().apiUrl}/v1/events`;
}
