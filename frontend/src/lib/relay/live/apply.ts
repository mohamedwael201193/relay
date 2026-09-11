import type { AppNotification, ArenaRunner, AssetId, BookSnapshot, BoostRelationship, Lap, LapEvent, LapPhase, LiveLap, MarketWindow, Outcome, Runner, WindowCadence } from "../types";
import { fillIsVerified, mapBackendState } from "../mapping";
import type { ArenaBoost, ArenaRow, HistoryLap, LiveMarketRow, ProofBundle, RunnerRow } from "../api/client";
import { EMPTY_BOOK } from "../config/network";
import {
  deriveVisualPhase,
  hasOracleAnswer,
  interpolatePhaseHistory,
  intervalMsFromSec,
  isInFlightState,
  remainingMs,
  windowBounds,
} from "./activeLap";

function shortHandle(addr: string): string {
  if (!addr) return "@runner";
  return `@${addr.slice(2, 6)}${addr.slice(-2)}`.toLowerCase();
}

function glyphFrom(addr: string) {
  let n = 0;
  for (let i = 2; i < Math.min(addr.length, 10); i++) n = (n * 16 + parseInt(addr[i] || "0", 16)) | 0;
  return { hue: Math.abs(n) % 360, shape: Math.abs(n) % 4 };
}

/** Consecutive verified wins from backend lap states. Voids keep the run; open laps do not reset it. */
export function streakFromHistory(laps: HistoryLap[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const lap of laps) {
    if (lap.state === "SETTLED_VOID") continue;
    if (lap.shielded && lap.state === "SETTLED_LOSS") continue;
    if (lap.state === "SETTLED_WIN" || lap.state === "REDEEMED") {
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
      laps > 0 && wrRaw != null && wrRaw !== "" && Number.isFinite(Number(wrRaw))
        ? Number(wrRaw)
        : Number.NaN;
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
      boosters: Number(r.boosters) || 0,
      status:
        r.state === "PAUSED" || r.state === "ERROR" || r.state === "STOPPED"
          ? "PAUSED"
          : "RUNNING",
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

function microUsd(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return Number.NaN;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n / 1e6 : Number.NaN;
}

/**
 * DreamDEX `placeBinaryOrder` price is always YES-terms.
 * The Hold card / tape quote the price paid in the position's own terms
 * (NO = 1 − YES), matching vault escrow `qty * (unit − yes) / unit`.
 */
export function sideEntryFromYes(yes: number, side: "UP" | "DOWN"): number {
  if (!Number.isFinite(yes) || yes < 0) return 0;
  if (side === "DOWN") return yes >= 1 ? 0 : 1 - yes;
  return yes;
}

export function collateralFromYes(yes: number, qty: number, side: "UP" | "DOWN"): number {
  const paid = sideEntryFromYes(yes, side);
  if (!(paid > 0) || !(qty > 0)) return 0;
  return paid * qty;
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
  const asset = assetFromMarket(r.marketId, r, []);
  const intervalMs = intervalMsFromSec(r.intervalSec);
  const bounds = windowBounds({ intervalMs, expirySec: r.expiry, now });
  const openPrice = Number(r.openPrice);
  return {
    id: r.marketId,
    marketId: r.marketId,
    asset,
    label: `${asset} Up or Down`,
    cadence: cadenceFromInterval(r.intervalSec ?? null),
    openPrice: Number.isFinite(openPrice) && openPrice > 0 ? openPrice : 0,
    opensAt: bounds.opensAt,
    closesAt: bounds.closesAt,
    venue: "DreamDEX · Event Contracts",
    collateral: "tUSDC" as const,
    live: r.onchainStatus === "Trading",
  };
}

function phaseLabel(phase: LapPhase, lastError: string | null): string {
  switch (phase) {
    case "SCAN":
      return "SCANNING WINDOWS";
    case "ARMED":
      return "DECISION PREPARED";
    case "ORDER":
      return "ORDER ACCEPTED · WAITING FOR FILL";
    case "FILL":
      return "FILLED";
    case "HOLD":
      return "POSITION LIVE";
    case "CLOSING":
      return "WINDOW CLOSED";
    case "ORACLE":
      return lastError === "waiting_reactivity" ? "WAITING FOR RESOLUTION" : "ORACLE ANSWER";
    case "RESULT":
      return "RESULT";
    case "CLAIM":
      return "CLAIM / REDEEM";
    case "REARM":
      return "RE-ARMING NEXT WINDOW";
    default:
      return phase;
  }
}

function eventsFromHistory(
  history: LapPhase[],
  prev: LiveLap | null | undefined,
  sameLap: boolean,
  now: number,
  lastError: string | null,
  lastMarketId: string | undefined,
): LapEvent[] {
  const kept = sameLap && prev ? prev.events.filter((e) => history.includes(e.kind as LapPhase)) : [];
  const seen = new Set(kept.map((e) => e.kind));
  const extra: LapEvent[] = [];
  for (const phase of history) {
    if (seen.has(phase)) continue;
    extra.push({
      id: `ev-${phase}`,
      at: now,
      kind: phase,
      label: phaseLabel(phase, lastError),
      detail: lastError ?? lastMarketId,
    });
  }
  return [...kept, ...extra];
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
    return { ...EMPTY_BOOK, spread: Number.NaN };
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
  const windows = rows
    .filter((r) => r.onchainStatus === "Trading" || r.onchainStatus === "Locked")
    .map((r) => windowFromMarketRow(r, now));
  const open = windows
    .filter((w) => w.closesAt > now && (w.live || w.opensAt > now))
    .sort((a, b) => a.closesAt - b.closesAt);
  const rest = windows.filter((w) => !open.some((o) => o.marketId === w.marketId));
  return [...open, ...rest].slice(0, 6);
}

export function liveLapFromState(opts: {
  row: RunnerRow;
  markets: LiveMarketRow[];
  proof: ProofBundle | null;
  now: number;
  history?: HistoryLap[];
  prev?: LiveLap | null;
}): LiveLap | null {
  const mapped = mapBackendState(opts.row.state);
  if (!mapped.phase) return null;
  const lastId = (opts.row.last_market_id ?? "").toLowerCase();
  const lapIndex = opts.row.lap_index || 0;
  const prevLap = opts.prev ?? null;
  const sameLap = Boolean(prevLap && prevLap.number === lapIndex && lapIndex > 0);
  const freeze = Boolean(
    sameLap &&
      prevLap &&
      prevLap.phase !== "SCAN" &&
      (isInFlightState(opts.row.state) ||
        opts.row.state === "DISCOVERING" ||
        opts.row.state === "REARMING" ||
        opts.row.state === "ACTIVE"),
  );
  const pinnedId = (freeze && prevLap ? prevLap.market.marketId : lastId).toLowerCase();
  const raw = pinnedId ? opts.markets.find((m) => m.marketId.toLowerCase() === pinnedId) : undefined;
  const hist =
    (pinnedId ? opts.history?.find((h) => h.market_id.toLowerCase() === pinnedId) : undefined) ??
    opts.history?.find((h) => h.lap_index === lapIndex) ??
    opts.history?.at(-1);

  let market: MarketWindow | null = null;
  if (pinnedId) {
    const intervalMs = intervalMsFromSec(hist?.interval_sec ?? raw?.intervalSec);
    const bounds = windowBounds({
      intervalMs,
      expirySec: raw?.expiry,
      createdAt: hist?.created_at,
      now: opts.now,
      prev: sameLap && prevLap ? { opensAt: prevLap.market.opensAt, closesAt: prevLap.market.closesAt } : null,
    });
    const asset =
      freeze && prevLap
        ? prevLap.market.asset
        : assetFromMarket(pinnedId, hist ?? raw ?? {}, opts.markets);
    const histOpen = Number(hist?.open_price);
    const rawOpen = Number(raw?.openPrice);
    const openPrice =
      Number.isFinite(histOpen) && histOpen > 0
        ? histOpen
        : Number.isFinite(rawOpen) && rawOpen > 0
          ? rawOpen
          : freeze && prevLap
            ? prevLap.market.openPrice
            : 0;
    market = {
      id: pinnedId,
      marketId: pinnedId,
      asset,
      label: `${asset} Up or Down`,
      cadence: cadenceFromInterval(hist?.interval_sec ?? raw?.intervalSec ?? null),
      openPrice,
      opensAt: bounds.opensAt,
      closesAt: bounds.closesAt,
      venue: "DreamDEX · Event Contracts",
      collateral: "tUSDC",
      live: raw?.onchainStatus === "Trading",
    };
  } else if (!isInFlightState(opts.row.state)) {
    const cal = calendarFromMarkets(opts.markets, opts.now);
    market = cal[0] ?? null;
  }
  if (!market) return null;

  const lastOrder = opts.proof?.orders.find((o) => o.lap_index === lapIndex);
  const settlement = opts.proof?.settlements.find((s) => s.lap_index === lapIndex);
  const verifiedFill = Boolean(lastOrder && fillIsVerified(lastOrder.fill_class));
  const side = sideFromKind((lastOrder as { kind?: string | number | null } | undefined)?.kind);
  const phase = deriveVisualPhase({
    backendState: opts.row.state,
    verifiedFill,
    now: opts.now,
    closesAt: market.closesAt,
    lastError: opts.row.last_error,
    hasOracleAnswer: hasOracleAnswer({
      hist,
      settlement,
      lastError: opts.row.last_error,
    }),
    histState: hist?.state,
  });
  const phaseHistory = interpolatePhaseHistory(phase, sameLap ? prevLap?.phaseHistory : undefined, sameLap);
  const windowTotal = Math.max(1, market.closesAt - market.opensAt);
  const elapsed = Math.max(0, Math.min(windowTotal, opts.now - market.opensAt));
  const left = remainingMs(market.closesAt, opts.now);
  const fillYes = lastOrder?.price ? Number(lastOrder.price) / 1e6 : 0;
  const qty = lastOrder?.quantity ? Number(lastOrder.quantity) / 1e6 : 0;
  const entryPaid = sideEntryFromYes(fillYes, side);
  const histStake = microUsd(hist?.entry_cost);
  const stake =
    Number.isFinite(histStake) && histStake > 0
      ? histStake
      : collateralFromYes(fillYes, qty, side);
  const fromRow =
    raw && Number.isFinite(Number(raw.livePrice)) && Number(raw.livePrice) > 0
      ? Number(raw.livePrice)
      : 0;
  const liveUnderlying = fromRow > 0 ? fromRow : liveFeedPrice(opts.markets, market.asset);
  return {
    number: lapIndex || 1,
    market,
    phase,
    previousPhase: sameLap ? prevLap?.phase ?? null : null,
    phaseHistory,
    phaseStartedAt: sameLap && prevLap?.phase === phase ? prevLap.phaseStartedAt : opts.now,
    windowElapsedMs: elapsed,
    windowTotalMs: windowTotal,
    countdownMs: Number.isFinite(left) ? left : 0,
    position:
      verifiedFill && lastOrder
        ? {
            id: `pos-${opts.row.lap_index}`,
            lapNumber: opts.row.lap_index,
            marketId: lastOrder.market_id,
            side,
            stake,
            entryPrice: entryPaid,
            quantity: qty,
            markPrice: entryPaid,
          }
        : null,
    order: lastOrder
      ? {
          id: `ord-${lastOrder.lap_index}`,
          kind: "IOC" as const,
          side,
          price: entryPaid,
          quantity: qty,
          stake,
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
            price: entryPaid,
            quantity: Number(lastOrder.filled) / 1e6,
            filledAt: Date.parse(lastOrder.created_at) || opts.now,
            tx: { hash: lastOrder.tx_hash, block: 0, at: Date.parse(lastOrder.created_at) || opts.now },
          }
        : null,
    price: liveUnderlying,
    probUp: fillYes > 0 ? fillYes : Number.NaN,
    events: eventsFromHistory(
      phaseHistory,
      prevLap,
      sameLap,
      opts.now,
      opts.row.last_error,
      opts.row.last_market_id ?? undefined,
    ),
  };
}

function historyOutcome(h: HistoryLap, settle: ProofBundle["settlements"][number] | undefined): Lap["outcome"] | null {
  if (h.state === "SETTLED_WIN" || h.state === "REDEEMED") return "WIN";
  if (h.state === "SETTLED_LOSS") return "LOSS";
  if (h.state === "SETTLED_VOID" || settle?.voided) return "VOID";
  return null;
}

function marketOutcomeFromSettle(
  settle: ProofBundle["settlements"][number] | undefined,
  outcome: Lap["outcome"],
): Outcome {
  if (settle?.voided || outcome === "VOID") return "VOID";
  const nums = settle?.payout_numerators;
  if (Array.isArray(nums) && nums.length >= 2) {
    const yes = Number(nums[0]);
    const no = Number(nums[1]);
    if (yes > 0 && !(no > 0)) return "UP";
    if (no > 0 && !(yes > 0)) return "DOWN";
  }
  return outcome === "LOSS" ? "DOWN" : "UP";
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
    const yes = order.price ? Number(order.price) / 1e6 : 0;
    const qty = order.quantity ? Number(order.quantity) / 1e6 : 0;
    const filledQty = order.filled ? Number(order.filled) / 1e6 : 0;
    const placedAt = Date.parse(h.created_at) || 0;
    const tx = { hash: order.tx_hash, block: 0, at: placedAt };
    const asset = assetFromMarket(h.market_id, h, markets);
    const side = sideFromKind((order as { kind?: string | number | null }).kind);
    const cadence = cadenceFromInterval(h.interval_sec ?? markets.find((m) => m.marketId.toLowerCase() === h.market_id.toLowerCase())?.intervalSec);
    const entryPaid = sideEntryFromYes(yes, side);
    const entryCost = microUsd(h.entry_cost);
    const stake =
      Number.isFinite(entryCost) && entryCost > 0
        ? entryCost
        : collateralFromYes(yes, filledQty || qty, side);
    const pnl =
      outcome === "OPEN"
        ? Number.NaN
        : h.pnl != null && h.pnl !== ""
          ? Number(h.pnl) / 1e6
          : Number.NaN;
    const marketOutcome = marketOutcomeFromSettle(settle, outcome);
    const mkt = markets.find((m) => m.marketId.toLowerCase() === h.market_id.toLowerCase());
    const intervalMs = intervalMsFromSec(h.interval_sec ?? mkt?.intervalSec);
    const bounds = windowBounds({
      intervalMs,
      expirySec: mkt?.expiry,
      createdAt: h.created_at,
      now: placedAt || Date.now(),
    });
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
    const sealedAt = settle ? Date.parse(settle.created_at) || 0 : 0;
    return [{
      number: h.lap_index,
      market: {
        asset,
        label: `${asset} Up or Down`,
        marketId: h.market_id,
        windowStart: bounds.opensAt,
        windowEnd: bounds.closesAt,
        openPrice,
        closePrice,
        cadence,
      },
      side,
      stake,
      entryPrice: entryPaid,
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
        price: entryPaid,
        quantity: qty,
        stake,
        placedAt,
        status: "FILLED" as const,
        tx,
        latencyMs: 0, // unmeasured — UI must not render 0ms as a timing
      },
      fill: {
        id: `fil-${h.lap_index}`,
        orderId: `ord-${h.lap_index}`,
        price: entryPaid,
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
        sealedAt,
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
  return built as Lap[];
}

/** Vault cash + open escrow − realized tape = the bankroll this runner started with. */
export function impliedStartBankroll(vaultBal: number, laps: Lap[]): number {
  const realized = laps
    .filter((l) => l.outcome !== "OPEN" && Number.isFinite(l.pnl))
    .reduce((a, l) => a + l.pnl, 0);
  const openStake = laps
    .filter((l) => l.outcome === "OPEN" && Number.isFinite(l.stake) && l.stake > 0)
    .reduce((a, l) => a + l.stake, 0);
  const start = vaultBal - realized + openStake;
  return Number.isFinite(start) && start > 0 ? start : vaultBal;
}

function fillHashLooksReal(hash: string | undefined): boolean {
  return Boolean(hash && /^0x[0-9a-fA-F]{16,}$/.test(hash));
}

/** New fills and settled laps since `prev`. OPEN without a real fill is silent. Does not invent lastResult. */
export function notificationsFromLaps(prev: Lap[], next: Lap[]): AppNotification[] {
  const prevByNumber = new Map(prev.map((l) => [l.number, l]));
  const out: AppNotification[] = [];
  for (const lap of next) {
    const before = prevByNumber.get(lap.number);
    if (lap.outcome === "OPEN") {
      const filled = fillHashLooksReal(lap.fill?.tx?.hash);
      const beforeFilled = fillHashLooksReal(before?.fill?.tx?.hash);
      if (filled && !beforeFilled) {
        const stakeBit = Number.isFinite(lap.stake) && lap.stake > 0 ? ` · $${lap.stake.toFixed(2)}` : "";
        out.push({
          id: `lap-${lap.number}-FILL`,
          kind: "FILL",
          title: `Lap ${lap.number} filled${stakeBit}`,
          body: `${lap.market.asset} ${lap.side} · waiting on the window.`,
          at: lap.fill?.filledAt || lap.order?.placedAt || 0,
          read: false,
          lap: lap.number,
        });
      }
      continue;
    }
    if (before && before.outcome === lap.outcome) continue;
    const kind: AppNotification["kind"] =
      lap.outcome === "WIN"
        ? "WIN"
        : lap.outcome === "VOID"
          ? "VOID"
          : lap.shielded
            ? "SHIELD"
            : "LOSS";
    const sign = lap.pnl > 0 ? "+" : lap.pnl < 0 ? "−" : "";
    const pnlBit =
      Number.isFinite(lap.pnl) && lap.pnl !== 0 ? ` — ${sign}$${Math.abs(lap.pnl).toFixed(2)}` : "";
    const streakBit = lap.streakAfter > 1 ? ` · streak ×${lap.streakAfter}` : "";
    out.push({
      id: `lap-${lap.number}-${kind}`,
      kind,
      title:
        kind === "VOID"
          ? `Lap ${lap.number} voided — stake returned`
          : kind === "WIN"
            ? `Lap ${lap.number} complete${pnlBit}${streakBit}`
            : kind === "SHIELD"
              ? `Lap ${lap.number} shield absorbed the loss${pnlBit}`
              : `Lap ${lap.number} resolved against you${pnlBit}`,
      body:
        kind === "VOID"
          ? "Stake returned. Streak preserved."
          : kind === "WIN"
            ? `${lap.market.asset} · streak ×${lap.streakAfter}. Re-armed for the next window.`
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

/** Park / re-arm from backend state. Ids are stable so polls do not re-spam. */
export function notificationsFromLifecycle(opts: {
  prevError: string | null;
  nextError: string | null;
  prevState: string | null;
  nextState: string;
  lapIndex?: number;
  at?: number;
}): AppNotification[] {
  const out: AppNotification[] = [];
  const at = opts.at ?? Date.now();
  if (opts.nextError === "daily_loss_exceeded" && opts.prevError !== "daily_loss_exceeded") {
    out.push({
      id: "park-daily-loss",
      kind: "INFO",
      title: "Parked at daily stop-loss",
      body: "On-chain realized loss hit maxDailyLoss. The runner waits for the next UTC day.",
      at,
      read: false,
    });
  }
  if (opts.nextState === "REARMING" && opts.prevState !== "REARMING") {
    out.push({
      id: `rearm-${opts.lapIndex ?? 0}`,
      kind: "INFO",
      title: "Re-armed for the next window",
      body: "Looking for the next matching Shannon book.",
      at,
      read: false,
    });
  }
  return out;
}

export function relationshipsFromArenaBoosts(
  rows: ArenaBoost[],
  arena: ArenaRunner[],
): BoostRelationship[] {
  return rows.map((b) => {
    const leader = arena.find((a) => a.runnerId.toLowerCase() === b.leader_vault.toLowerCase());
    const amt = b.budget != null && b.budget !== "" ? Number(b.budget) / 1e6 : NaN;
    return {
      runnerId: b.leader_vault,
      runnerName: leader?.name ?? shortHandle(b.leader_vault),
      amount: Number.isFinite(amt) ? amt : 0,
      boostedAt: Date.parse(b.created_at) || 0,
      mirroredRunnerId: b.child_vault,
      boosterHandle: shortHandle(b.owner),
    };
  });
}

export function notificationsFromBoosts(
  prev: BoostRelationship[],
  next: BoostRelationship[],
  myVault: string | null,
): AppNotification[] {
  if (!myVault) return [];
  const seen = new Set(prev.map((b) => b.mirroredRunnerId.toLowerCase()));
  return next
    .filter(
      (b) =>
        b.runnerId.toLowerCase() === myVault.toLowerCase() &&
        !seen.has(b.mirroredRunnerId.toLowerCase()),
    )
    .map((b) => ({
      id: `boost-${b.mirroredRunnerId}`,
      kind: "BOOST" as const,
      title: `${b.boosterHandle ?? "a runner"} boosted you${b.amount > 0 ? ` · $${b.amount.toFixed(2)}` : ""}`,
      body: "A new mirrored vault cloned your bias. Their funds, RELAY operator — not your wallet.",
      at: b.boostedAt || Date.now(),
      read: false,
    }));
}
