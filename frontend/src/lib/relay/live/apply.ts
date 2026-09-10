import type { ArenaRunner, Lap, LapPhase, LiveLap, MarketWindow, Runner } from "../types";
import { fillIsVerified, mapBackendState } from "../mapping";
import type { ArenaRow, HistoryLap, LiveMarketRow, ProofBundle, RunnerRow } from "../api/client";

function shortHandle(addr: string): string {
  if (!addr) return "@runner";
  return `@${addr.slice(2, 6)}${addr.slice(-2)}`.toLowerCase();
}

function glyphFrom(addr: string) {
  let n = 0;
  for (let i = 2; i < Math.min(addr.length, 10); i++) n = (n * 16 + parseInt(addr[i] || "0", 16)) | 0;
  return { hue: Math.abs(n) % 360, shape: Math.abs(n) % 4 };
}

/** Consecutive verified wins from backend lap states. Voids keep the run; the client never increments. */
export function streakFromHistory(laps: HistoryLap[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const lap of laps) {
    if (lap.state === "SETTLED_VOID") continue;
    if (lap.state === "FILLED" || lap.state === "ORDER_SUBMITTED" || lap.state === "PARTIAL_FILL") continue;
    if (lap.state === "SETTLED_WIN") {
      run += 1;
      if (run > best) best = run;
      continue;
    }
    if (lap.state === "SETTLED_LOSS") run = 0;
  }
  return { current: run, best };
}

export function runnerFromRow(row: RunnerRow, draftName: string, config: Runner["config"]): Runner {
  const mapped = mapBackendState(row.state);
  return {
    id: row.id,
    name: draftName || "Runner",
    ownerId: row.owner,
    ownerHandle: shortHandle(row.owner),
    status: mapped.runnerStatus,
    deployedAt: Date.now(),
    config,
    strategy:
      config.bias === "FOLLOW"
        ? "Follow the Book · post-only → IOC"
        : `Momentum · ${config.bias} · post-only → IOC`,
  };
}

export function arenaFromRows(rows: ArenaRow[], myVault: string | null): ArenaRunner[] {
  return rows.map((r, i) => {
    const laps = Number(r.verified_laps) || 0;
    return {
      rank: i + 1,
      runnerId: r.vault,
      name: shortHandle(r.vault),
      ownerHandle: shortHandle(r.owner),
      strategy: "Shannon runner",
      bias: "FOLLOW",
      streak: 0,
      bestStreak: 0,
      pnl7d: 0,
      pnlLifetime: 0,
      winRate: 0,
      laps,
      followers: 0,
      boosters: 0,
      status: r.state === "PAUSED" ? "PAUSED" : "RUNNING",
      delta: 0,
      verified: laps > 0,
      isYou: myVault ? r.vault.toLowerCase() === myVault.toLowerCase() : false,
      glyph: glyphFrom(r.vault),
      spark: [],
      ownerAddress: r.owner,
    };
  });
}

export function calendarFromMarkets(rows: LiveMarketRow[], now: number): MarketWindow[] {
  return rows
    .filter((r) => r.onchainStatus === "Trading" || r.onchainStatus === "Locked")
    .slice(0, 6)
    .map((r, i) => {
      const expiryMs = r.expiry ? Number(r.expiry) * 1000 : now + 60_000;
      const cadence = r.intervalSec === "3600" ? "1h" : r.intervalSec === "300" ? "5m" : r.intervalSec === "60" ? "1m" : "15m";
      const asset = r.asset === "ETH" ? "ETH" : "BTC";
      return {
        id: r.marketId,
        marketId: r.marketId,
        asset,
        label: `${asset} Up or Down`,
        cadence,
        openPrice: 0,
        opensAt: now,
        closesAt: Number.isFinite(expiryMs) ? expiryMs : now + 60_000,
        venue: "DreamDEX · Event Contracts",
        collateral: "tUSDC" as const,
        live: r.onchainStatus === "Trading",
      };
    });
}

export function liveLapFromState(opts: {
  row: RunnerRow;
  markets: LiveMarketRow[];
  proof: ProofBundle | null;
  now: number;
}): LiveLap | null {
  const mapped = mapBackendState(opts.row.state);
  if (!mapped.phase) return null;
  const cal = calendarFromMarkets(opts.markets, opts.now);
  const market =
    cal.find((m) => m.marketId.toLowerCase() === (opts.row.last_market_id ?? "").toLowerCase()) ?? cal[0];
  if (!market) {
    return null;
  }
  const lastOrder = opts.proof?.orders.at(-1);
  const verifiedFill = lastOrder && fillIsVerified(lastOrder.fill_class);
  const phase: LapPhase =
    opts.row.state === "ORDER_SUBMITTED" && !verifiedFill
      ? "ORDER"
      : opts.row.state === "FILLED" && !verifiedFill
        ? "ORDER"
        : mapped.phase;
  const windowTotal = Math.max(1, market.closesAt - market.opensAt);
  const elapsed = Math.max(0, Math.min(windowTotal, opts.now - market.opensAt));
  const price = lastOrder?.price ? Number(lastOrder.price) / 1e6 : 0;
  const qty = lastOrder?.quantity ? Number(lastOrder.quantity) / 1e6 : 0;
  return {
    number: opts.row.lap_index || 1,
    market,
    phase,
    phaseStartedAt: opts.now,
    windowElapsedMs: elapsed,
    windowTotalMs: windowTotal,
    countdownMs: Math.max(0, market.closesAt - opts.now),
    position:
      verifiedFill && lastOrder
        ? {
            id: `pos-${opts.row.lap_index}`,
            lapNumber: opts.row.lap_index,
            marketId: lastOrder.market_id,
            side: "UP",
            stake: price && qty ? price * qty : 0,
            entryPrice: price || 0,
            quantity: qty,
            markPrice: price || 0,
          }
        : null,
    order: lastOrder
      ? {
          id: `ord-${lastOrder.lap_index}`,
          kind: "IOC",
          side: "UP",
          price,
          quantity: qty,
          stake: price * qty,
          placedAt: Date.parse(lastOrder.created_at) || opts.now,
          status: verifiedFill ? "FILLED" : "PLACED",
          tx: { hash: lastOrder.tx_hash, block: 0, at: Date.parse(lastOrder.created_at) || opts.now },
          latencyMs: 0,
        }
      : null,
    fill:
      verifiedFill && lastOrder
        ? {
            id: `fil-${lastOrder.lap_index}`,
            orderId: `ord-${lastOrder.lap_index}`,
            price,
            quantity: Number(lastOrder.filled) / 1e6,
            filledAt: Date.parse(lastOrder.created_at) || opts.now,
            tx: { hash: lastOrder.tx_hash, block: 0, at: Date.parse(lastOrder.created_at) || opts.now },
          }
        : null,
    price: 0,
    probUp: price || 0.5,
    events: [
      {
        id: `ev-${opts.row.state}`,
        at: opts.now,
        kind: phase,
        label: labelForState(opts.row.state, verifiedFill),
        detail: opts.row.last_error ?? opts.row.last_market_id ?? undefined,
      },
    ],
  };
}

function labelForState(state: string, verifiedFill: boolean): string {
  if ((state === "ORDER_SUBMITTED" || state === "FILLED") && !verifiedFill) {
    return "ORDER ACCEPTED · WAITING FOR FILL";
  }
  if (state === "FILLED") return "FILLED";
  if (state === "PARTIAL_FILL") return "PARTIAL FILL";
  if (state === "DISCOVERING") return "DISCOVERING";
  if (state === "PREPARING") return "ORDER PREPARING";
  if (state === "WAITING_SETTLEMENT") return "WINDOW EXPIRING · SETTLEMENT";
  if (state === "REDEEMING" || state === "REDEEMED") return "REDEEM";
  if (state === "REARMING") return "REARMING";
  return state.replaceAll("_", " ");
}

function historyOutcome(h: HistoryLap, settle: ProofBundle["settlements"][number] | undefined): Lap["outcome"] | null {
  if (h.state === "SETTLED_WIN") return "WIN";
  if (h.state === "SETTLED_LOSS") return "LOSS";
  if (h.state === "SETTLED_VOID" || settle?.voided) return "VOID";
  return null;
}

export function lapsFromHistory(history: HistoryLap[], proof: ProofBundle | null): Lap[] {
  const orders = proof?.orders ?? [];
  const settlements = proof?.settlements ?? [];
  return history.flatMap((h) => {
    const order = orders.find((o) => o.lap_index === h.lap_index);
    const settle = settlements.find((s) => s.lap_index === h.lap_index);
    const verified = fillIsVerified(order?.fill_class);
    if (!verified || !order) return [];
    const outcome = historyOutcome(h, settle) ?? "OPEN";
    const price = order.price ? Number(order.price) / 1e6 : 0;
    const qty = order.quantity ? Number(order.quantity) / 1e6 : 0;
    const filledQty = order.filled ? Number(order.filled) / 1e6 : 0;
    const placedAt = Date.parse(h.created_at) || 0;
    const tx = { hash: order.tx_hash, block: 0, at: placedAt };
    return [{
      number: h.lap_index,
      market: {
        asset: "BTC",
        label: "Event contract",
        marketId: h.market_id,
        windowStart: placedAt,
        windowEnd: placedAt,
        openPrice: 0,
        closePrice: 0,
        cadence: "1m",
      },
      side: "UP" as const,
      stake: price * qty,
      entryPrice: price,
      outcome,
      marketOutcome: settle?.voided ? "VOID" : outcome === "LOSS" ? "DOWN" : "UP",
      pnl: 0,
      streakAfter: 0,
      shielded: false,
      settledAt: settle ? Date.parse(settle.created_at) || placedAt : placedAt,
      order: {
        id: `ord-${h.lap_index}`,
        kind: "IOC",
        side: "UP",
        price,
        quantity: qty,
        stake: price * qty,
        placedAt,
        status: "FILLED",
        tx,
        latencyMs: 0,
      },
      fill: {
        id: `fil-${h.lap_index}`,
        orderId: `ord-${h.lap_index}`,
        price,
        quantity: filledQty,
        filledAt: placedAt,
        tx,
      },
      proof: {
        marketId: h.market_id,
        lap: h.lap_index,
        fillTx: order.tx_hash,
        settlementTx: settle?.redeem_tx ?? "",
        claimTx: settle?.redeem_tx ?? "",
        oracleQuestionId: "",
        status: settle ? "VERIFIED" : "PENDING",
        sealedAt: settle ? Date.parse(settle.created_at) || 0 : 0,
      },
    }];
  });
}
