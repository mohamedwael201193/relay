import type { AppNotification, ArenaRunner, AssetId, BookSnapshot, Lap, LapPhase, LiveLap, MarketWindow, Outcome, Runner, WindowCadence } from "../types";
import { fillIsVerified, mapBackendState } from "../mapping";
import type { ArenaRow, HistoryLap, LiveMarketRow, ProofBundle, RunnerRow } from "../api/client";
import { EMPTY_BOOK } from "../config/network";

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
    if (lap.shielded && lap.state === "SETTLED_LOSS") continue;
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

function biasFromRow(raw: string | null | undefined): "UP" | "DOWN" | "FOLLOW" {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "UP" || s === "DOWN" || s === "FOLLOW") return s;
  return "FOLLOW";
}

function assetsFromRow(raw: string[] | null | undefined): AssetId[] {
  const list = (raw ?? []).map((a) => String(a).toUpperCase()).filter((a): a is AssetId => a === "BTC" || a === "ETH");
  return list.length ? list : ["BTC", "ETH"];
}

export function arenaFromRows(rows: ArenaRow[], myVault: string | null): ArenaRunner[] {
  return rows.map((r, i) => {
    const laps = Number(r.verified_laps) || 0;
    const wrRaw = r.win_rate;
    const winRate =
      wrRaw == null || wrRaw === "" ? Number.NaN : Number(wrRaw);
    const closed = laps > 0;
    const pnlLife = closed && r.pnl_raw != null && r.pnl_raw !== "" ? Number(r.pnl_raw) / 1e6 : Number.NaN;
    const pnl7 = closed && r.pnl_7d_raw != null && r.pnl_7d_raw !== "" ? Number(r.pnl_7d_raw) / 1e6 : pnlLife;
    const bias = biasFromRow(r.bias);
    const cadence = cadenceFromInterval(r.interval_sec);
    const assets = assetsFromRow(r.assets);
    return {
      rank: i + 1,
      runnerId: r.vault,
      name: shortHandle(r.vault),
      ownerHandle: shortHandle(r.owner),
      strategy:
        bias === "FOLLOW"
          ? "Follow the Book · post-only → IOC"
          : `Momentum · ${bias} · post-only → IOC`,
      bias,
      streak: Number(r.streak) || 0,
      bestStreak: Number(r.best_streak) || 0,
      pnl7d: pnl7,
      pnlLifetime: pnlLife,
      winRate,
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
      cadence,
      assets,
    };
  });
}

export function cadenceFromInterval(intervalSec?: string | null): WindowCadence {
  if (intervalSec === "3600") return "1h";
  if (intervalSec === "300") return "5m";
  if (intervalSec === "60") return "1m";
  return "15m";
}

/** Shannon binary YES is UP. BUY_NO is DOWN. */
export function sideFromKind(kind?: string | number | null): "UP" | "DOWN" {
  const k = String(kind ?? "").toUpperCase();
  if (k === "BUY_NO" || k === "NO" || k === "DOWN" || k === "SELL_YES" || k === "1") return "DOWN";
  return "UP";
}

export function assetFromMarket(
  marketId: string | null | undefined,
  source: { asset?: string | null } | null | undefined,
  markets: LiveMarketRow[] = [],
): AssetId {
  const tagged = source?.asset?.toUpperCase();
  if (tagged === "ETH" || tagged === "BTC") return tagged;
  const id = (marketId ?? "").toLowerCase();
  const row = markets.find((m) => m.marketId.toLowerCase() === id);
  const live = row?.asset?.toUpperCase();
  if (live === "ETH" || live === "BTC") return live;
  return "BTC";
}

function windowFromMarketRow(r: LiveMarketRow, now: number): MarketWindow {
  const expiryMs = r.expiry ? Number(r.expiry) * 1000 : now + 60_000;
  const asset = assetFromMarket(r.marketId, r, []);
  const openPrice = Number(r.openPrice);
  return {
    id: r.marketId,
    marketId: r.marketId,
    asset,
    label: `${asset} Up or Down`,
    cadence: cadenceFromInterval(r.intervalSec ?? null),
    openPrice: Number.isFinite(openPrice) && openPrice > 0 ? openPrice : 0,
    opensAt: now,
    closesAt: Number.isFinite(expiryMs) ? expiryMs : now + 60_000,
    venue: "DreamDEX · Event Contracts",
    collateral: "tUSDC" as const,
    live: r.onchainStatus === "Trading",
  };
}

/** BTC/ETH feed is shared across windows. Never copy another market's opening print. */
export function liveFeedPrice(markets: LiveMarketRow[], asset: string): number {
  const want = asset.toUpperCase();
  for (const m of markets) {
    if ((m.asset ?? "").toUpperCase() !== want) continue;
    const p = Number(m.livePrice);
    if (Number.isFinite(p) && p > 0) return p;
  }
  return 0;
}

export function liveFeedHistory(markets: LiveMarketRow[], asset: string): { t: number; p: number }[] {
  const want = asset.toUpperCase();
  for (const m of markets) {
    if ((m.asset ?? "").toUpperCase() !== want) continue;
    const hist = (m.priceHistory ?? []).filter((p) => Number.isFinite(p.p) && p.p > 0);
    if (hist.length > 1) return hist;
  }
  return [];
}

export function bookSnapshotFromLive(book: LiveMarketRow["book"] | null | undefined): BookSnapshot {
  if (!book) return EMPTY_BOOK;
  const bidUp = book.bidUp ?? [];
  const askUp = book.askUp ?? [];
  const bidDown = book.bidDown ?? [];
  const askDown = book.askDown ?? [];
  if (bidUp.length === 0 && askUp.length === 0 && bidDown.length === 0 && askDown.length === 0) {
    return EMPTY_BOOK;
  }
  const spread =
    book.spread != null && Number.isFinite(book.spread)
      ? book.spread
      : bidUp[0] && askUp[0]
        ? askUp[0].price - bidUp[0].price
        : Number.NaN;
  return { bidUp, askUp, bidDown, askDown, spread };
}

export function calendarFromMarkets(rows: LiveMarketRow[], now: number): MarketWindow[] {
  return rows
    .filter((r) => r.onchainStatus === "Trading" || r.onchainStatus === "Locked")
    .slice(0, 6)
    .map((r) => windowFromMarketRow(r, now));
}

export function liveLapFromState(opts: {
  row: RunnerRow;
  markets: LiveMarketRow[];
  proof: ProofBundle | null;
  now: number;
  history?: HistoryLap[];
}): LiveLap | null {
  const mapped = mapBackendState(opts.row.state);
  if (!mapped.phase) return null;
  const cal = calendarFromMarkets(opts.markets, opts.now);
  const lastId = (opts.row.last_market_id ?? "").toLowerCase();
  const raw = opts.markets.find((m) => m.marketId.toLowerCase() === lastId);
  const hist =
    opts.history?.find((h) => h.market_id.toLowerCase() === lastId) ??
    opts.history?.at(-1);
  const holdingAsset = assetFromMarket(lastId, hist ?? raw ?? {}, opts.markets);
  const histOpen = Number(hist?.open_price);
  const holdingWindow: MarketWindow | null = lastId
    ? {
        id: lastId,
        marketId: lastId,
        asset: holdingAsset,
        label: `${holdingAsset} Up or Down`,
        cadence: cadenceFromInterval(hist?.interval_sec ?? raw?.intervalSec ?? null),
        openPrice: Number.isFinite(histOpen) && histOpen > 0 ? histOpen : 0,
        opensAt: opts.now,
        closesAt: raw?.expiry ? Number(raw.expiry) * 1000 : opts.now,
        venue: "DreamDEX · Event Contracts",
        collateral: "tUSDC" as const,
        live: false,
      }
    : null;
  const market =
    cal.find((m) => m.marketId.toLowerCase() === lastId) ??
    (raw ? windowFromMarketRow(raw, opts.now) : holdingWindow ?? cal[0]);
  if (!market) {
    return null;
  }
  const lastOrder = opts.proof?.orders.at(-1);
  const verifiedFill = lastOrder && fillIsVerified(lastOrder.fill_class);
  const side = sideFromKind((lastOrder as { kind?: string | number | null } | undefined)?.kind);
  const phase: LapPhase =
    opts.row.state === "ORDER_SUBMITTED" && !verifiedFill
      ? "ORDER"
      : opts.row.state === "FILLED" && !verifiedFill
        ? "ORDER"
        : mapped.phase;
  const windowTotal = Math.max(1, market.closesAt - market.opensAt);
  const elapsed = Math.max(0, Math.min(windowTotal, opts.now - market.opensAt));
  const fillYes = lastOrder?.price ? Number(lastOrder.price) / 1e6 : 0;
  const qty = lastOrder?.quantity ? Number(lastOrder.quantity) / 1e6 : 0;
  const fromRow =
    raw && Number.isFinite(Number(raw.livePrice)) && Number(raw.livePrice) > 0
      ? Number(raw.livePrice)
      : 0;
  const liveUnderlying = fromRow > 0 ? fromRow : liveFeedPrice(opts.markets, market.asset);
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
            side,
            stake: fillYes && qty ? fillYes * qty : 0,
            entryPrice: fillYes || 0,
            quantity: qty,
            markPrice: fillYes || 0,
          }
        : null,
    order: lastOrder
      ? {
          id: `ord-${lastOrder.lap_index}`,
          kind: "IOC" as const,
          side,
          price: fillYes,
          quantity: qty,
          stake: fillYes * qty,
          placedAt: Date.parse(lastOrder.created_at) || opts.now,
          status: verifiedFill ? "FILLED" : "PLACED",
          tx: { hash: lastOrder.tx_hash, block: 0, at: Date.parse(lastOrder.created_at) || opts.now },
          latencyMs: 0, // unmeasured — UI must not render 0ms as a timing
        }
      : null,
    fill:
      verifiedFill && lastOrder
        ? {
            id: `fil-${lastOrder.lap_index}`,
            orderId: `ord-${lastOrder.lap_index}`,
            price: fillYes,
            quantity: Number(lastOrder.filled) / 1e6,
            filledAt: Date.parse(lastOrder.created_at) || opts.now,
            tx: { hash: lastOrder.tx_hash, block: 0, at: Date.parse(lastOrder.created_at) || opts.now },
          }
        : null,
    price: liveUnderlying,
    probUp: fillYes > 0 ? fillYes : Number.NaN,
    events: [
      {
        id: `ev-${opts.row.state}`,
        at: opts.now,
        kind: phase,
        label: labelForState(opts.row.state, Boolean(verifiedFill)),
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

export function lapsFromHistory(
  history: HistoryLap[],
  proof: ProofBundle | null,
  markets: LiveMarketRow[] = [],
): Lap[] {
  const orders = proof?.orders ?? [];
  const settlements = proof?.settlements ?? [];
  const built = history.flatMap((h) => {
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
    const asset = assetFromMarket(h.market_id, h, markets);
    const side = sideFromKind((order as { kind?: string | number | null }).kind);
    const cadence = cadenceFromInterval(h.interval_sec ?? markets.find((m) => m.marketId.toLowerCase() === h.market_id.toLowerCase())?.intervalSec);
    const entryCost = h.entry_cost != null && h.entry_cost !== "" ? Number(h.entry_cost) / 1e6 : NaN;
    const stake = Number.isFinite(entryCost) ? entryCost : price * (filledQty || qty);
    const pnl =
      outcome === "OPEN"
        ? 0
        : h.pnl != null && h.pnl !== ""
          ? Number(h.pnl) / 1e6
          : Number.NaN;
    const marketOutcome: Outcome = settle?.voided ? "VOID" : outcome === "LOSS" ? "DOWN" : "UP";
    const mkt = markets.find((m) => m.marketId.toLowerCase() === h.market_id.toLowerCase());
    const histOpen = Number(h.open_price);
    const histClose = Number(h.close_price);
    const openPrice =
      Number.isFinite(histOpen) && histOpen > 0
        ? histOpen
        : Number.isFinite(Number(mkt?.openPrice)) && Number(mkt?.openPrice) > 0
          ? Number(mkt?.openPrice)
          : 0;
    const closePrice =
      Number.isFinite(histClose) && histClose > 0
        ? histClose
        : Number.isFinite(Number(mkt?.closePrice)) && Number(mkt?.closePrice) > 0
          ? Number(mkt?.closePrice)
          : 0;
    return [{
      number: h.lap_index,
      market: {
        asset,
        label: `${asset} Up or Down`,
        marketId: h.market_id,
        windowStart: placedAt,
        windowEnd: placedAt,
        openPrice,
        closePrice,
        cadence,
      },
      side,
      stake,
      entryPrice: price,
      outcome,
      marketOutcome,
      pnl,
      streakAfter: 0,
      shielded: Boolean(h.shielded),
      settledAt: settle ? Date.parse(settle.created_at) || placedAt : placedAt,
      order: {
        id: `ord-${h.lap_index}`,
        kind: "IOC" as const,
        side,
        price,
        quantity: qty,
        stake: price * qty,
        placedAt,
        status: "FILLED",
        tx,
        latencyMs: 0, // unmeasured — UI must not render 0ms as a timing
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
        oracleQuestionId: h.oracle_question_id || mkt?.oracleQuestionId || "",
        status: settle?.redeem_tx ? "VERIFIED" : settle ? "PENDING" : "PENDING",
        sealedAt: settle ? Date.parse(settle.created_at) || 0 : 0,
      },
    }];
  });
  let run = 0;
  for (const lap of built) {
    if (lap.outcome === "WIN") {
      run += 1;
      lap.streakAfter = run;
    } else if (lap.outcome === "LOSS" && lap.shielded) {
      lap.streakAfter = run;
    } else if (lap.outcome === "LOSS") {
      run = 0;
      lap.streakAfter = 0;
    } else {
      lap.streakAfter = run;
    }
  }
  return built;
}

/** New settled laps since `prev`. OPEN fills are not results. Does not invent lastResult. */
export function notificationsFromLaps(prev: Lap[], next: Lap[]): AppNotification[] {
  const prevByNumber = new Map(prev.map((l) => [l.number, l]));
  const out: AppNotification[] = [];
  for (const lap of next) {
    if (lap.outcome === "OPEN") continue;
    const before = prevByNumber.get(lap.number);
    if (before && before.outcome === lap.outcome) continue;
    const kind: AppNotification["kind"] =
      lap.outcome === "WIN" ? "WIN" : lap.outcome === "LOSS" ? "LOSS" : "VOID";
    const sign = lap.pnl > 0 ? "+" : lap.pnl < 0 ? "−" : "";
    const pnlBit = lap.pnl !== 0 ? ` — ${sign}$${Math.abs(lap.pnl).toFixed(2)}` : "";
    out.push({
      id: `lap-${lap.number}-${kind}`,
      kind,
      title:
        kind === "VOID"
          ? `Lap ${lap.number} voided — stake returned`
          : kind === "WIN"
            ? `Lap ${lap.number} complete${pnlBit}`
            : lap.shielded
              ? `Lap ${lap.number} shield absorbed the loss${pnlBit}`
              : `Lap ${lap.number} resolved against you${pnlBit}`,
      body:
        kind === "VOID"
          ? "Stake returned. Streak preserved."
          : lap.shielded
            ? `${lap.market.asset} · streak ×${lap.streakAfter} held.`
            : `${lap.market.asset} · streak ×${lap.streakAfter}.`,
      at: lap.settledAt || 0,
      read: false,
      lap: lap.number,
    });
  }
  return out;
}
