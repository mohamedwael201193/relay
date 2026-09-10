import { randomUUID } from "node:crypto";
import { decodeEventLog, parseAbi, type Address, type Hex, type Log } from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { ORDER_KIND, ORDER_TYPE, orderBookEventsAbi } from "@somnia-chain/markets-sdk";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { classifyFill, collateralCostForKind, quantityForStake, snapDown } from "./quant.js";
import { shannonHttpClient } from "./sendHttp.js";
import { sendHttp } from "./sendHttp.js";
import { loadShannonDeployment, writeEvidence } from "./vaultOps.js";
import { erc20Balance } from "./rpc.js";
import { discoverLiveMarket, type LivePick } from "./discover.js";
import { assertShannonExecution } from "./gates.js";

const COLLATERAL = requiredAddress(SHANNON_ADDRESSES.collateral, "collateral");

const vaultWriteAbi = parseAbi([
  "function arm(bytes32 marketId, uint8 kind, uint256 price, uint256 quantity, uint64 expireNs, uint8 orderType)",
  "function placeArmed() returns (bool accepted, uint128 orderId)",
  "function cancelLast()",
  "event Placed(bytes32 indexed marketId, uint128 orderId, bool accepted, uint256 notional)",
  "event PlacementRejected(bytes32 indexed marketId, string reason)",
  "event Armed(bytes32 indexed marketId, address pool, uint64 nonce, uint8 kind, uint256 price, uint256 quantity)",
]);

const PLACE_GAS = 20_000_000n;

export type AttemptResult = {
  correlationId: string;
  marketId: Hex;
  pool: Address;
  nonce: string;
  kind: number;
  orderType: number;
  price: string;
  quantity: string;
  expireNs: string;
  armTx: Hex;
  placeTx: Hex;
  placeStatus: string;
  accepted: boolean | null;
  orderId: string | null;
  filled: string;
  fillClass: ReturnType<typeof classifyFill>;
  placedEvent: boolean;
  fillLogCount: number;
  vaultReason: string | null;
};

function decodeFills(logs: Log[]): { filled: bigint; placed: boolean; orderId: bigint | null } {
  let filled = 0n;
  let placed = false;
  let orderId: bigint | null = null;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: orderBookEventsAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "OrderPlaced") {
        placed = true;
        orderId = decoded.args.orderId as bigint;
      }
      if (decoded.eventName === "OrderFilled") {
        filled += decoded.args.quantityFilled as bigint;
      }
    } catch {
      /* other contracts */
    }
  }
  return { filled, placed, orderId };
}

function vaultRejectReason(logs: Log[]): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: vaultWriteAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "PlacementRejected") return decoded.args.reason;
    } catch {
      /* skip */
    }
  }
  return null;
}

export type RunnerBias = "UP" | "DOWN" | "FOLLOW";

/**
 * Vault/SDK `placeBinaryOrder` price is YES-terms. SDK `toBinaryBook` pre-inverts
 * NO levels (`noAsks`/`noBids` = unit − yes), so BUY_NO book quotes are NO-terms.
 */
function noToYes(noPrice: bigint, unit: bigint): bigint {
  if (noPrice <= 0n) throw new Error("NO price must be > 0");
  if (noPrice >= unit) throw new Error("NO price must be < unit");
  return unit - noPrice;
}

function postOnlyNative(bestBid: bigint | null, bestAsk: bigint | null, tick: bigint, sideLabel: string): bigint {
  let postPrice = bestBid ?? (bestAsk != null ? bestAsk - tick : 0n);
  postPrice = snapDown(postPrice, tick);
  if (postPrice < tick) postPrice = tick;
  if (bestAsk != null && postPrice >= bestAsk) {
    postPrice = snapDown(bestAsk - tick, tick);
  }
  if (postPrice < tick) {
    throw new Error(`POST_ONLY ${sideLabel} price collapsed below tick (empty/locked book)`);
  }
  return postPrice;
}

function resolveKind(
  opts: { bias?: RunnerBias; kind?: number },
  chosen: LivePick,
  unit: bigint,
): number {
  if (opts.kind === ORDER_KIND.BUY_NO || opts.kind === ORDER_KIND.BUY_YES) return opts.kind;
  if (opts.bias === "DOWN") return ORDER_KIND.BUY_NO;
  if (opts.bias === "UP") return ORDER_KIND.BUY_YES;
  if (opts.bias === "FOLLOW") {
    const mid =
      chosen.bestBid != null && chosen.bestAsk != null
        ? (chosen.bestBid + chosen.bestAsk) / 2n
        : (chosen.bestBid ?? chosen.bestAsk);
    if (mid == null) throw new Error("FOLLOW bias needs a YES mid; book empty");
    return mid >= unit / 2n ? ORDER_KIND.BUY_YES : ORDER_KIND.BUY_NO;
  }
  return ORDER_KIND.BUY_YES;
}

export async function runLiveOrder(
  account: LocalAccount,
  opts: {
    intervalSec?: string;
    iocOnly?: boolean;
    evidenceName?: string;
    skipMarketIds?: string[];
    waitMs?: number;
    maxExpiryHorizonSec?: number;
    vault?: Address;
    targetStakeRaw?: bigint;
    minRemainingFrac?: number;
    bias?: RunnerBias;
    kind?: number;
    assets?: string[];
  } = {},
): Promise<{
  postOnly: AttemptResult | null;
  ioc: AttemptResult | null;
  asset?: string;
  intervalSec?: string;
}> {
  assertShannonExecution();
  const dep = loadShannonDeployment();
  const vault = opts.vault ?? dep.vault;
  const client = shannonHttpClient();
  const correlationRoot = randomUUID();
  const iocOnly = Boolean(opts.iocOnly);
  const requireAsks = iocOnly && opts.kind !== ORDER_KIND.BUY_NO && opts.bias !== "DOWN";
  const requireNoAsks = iocOnly && (opts.kind === ORDER_KIND.BUY_NO || opts.bias === "DOWN");
  const discoverBase = {
    requireAsks,
    requireNoAsks,
    skipMarketIds: opts.skipMarketIds,
    maxExpiryHorizonSec: opts.maxExpiryHorizonSec,
    minRemainingFrac: opts.minRemainingFrac,
    assets: opts.assets,
  };
  let chosen = await discoverLiveMarket({
    ...discoverBase,
    intervalSec: opts.intervalSec,
    waitMs: opts.waitMs ?? 90_000,
  });
  if (!chosen && opts.intervalSec) {
    chosen = await discoverLiveMarket({
      ...discoverBase,
      waitMs: 20_000,
      maxExpiryHorizonSec: opts.maxExpiryHorizonSec ?? 320,
    });
  }

  if (!chosen) {
    throw new Error("no live Trading market with on-chain book and non-zero marketExpiryNs");
  }

  const tick = chosen.book.tickSize;
  const vaultBal = await erc20Balance(client, COLLATERAL, vault);
  const unit = 10n ** BigInt(chosen.decimals);
  const kind = resolveKind(opts, chosen, unit);
  const buyNo = kind === ORDER_KIND.BUY_NO;
  const nativeBid = buyNo ? chosen.bestNoBid : chosen.bestBid;
  const nativeAsk = buyNo ? chosen.bestNoAsk : chosen.bestAsk;
  const sideLabel = buyNo ? "NO" : "YES";

  if (buyNo && chosen.bestNoBid == null && chosen.bestNoAsk == null) {
    throw new Error("BUY_NO requested but no NO book (empty noBids/noAsks); not minting a complete set");
  }

  const sizeNative = nativeAsk ?? nativeBid ?? 0n;
  if (sizeNative <= 0n) {
    throw new Error(`no ${sideLabel} book price to size against`);
  }
  const sizePrice = buyNo ? noToYes(sizeNative, unit) : sizeNative;
  if (sizePrice <= 0n) {
    throw new Error("no book price to size against");
  }
  const stake =
    opts.targetStakeRaw && opts.targetStakeRaw > 0n
      ? opts.targetStakeRaw < vaultBal
        ? opts.targetStakeRaw
        : vaultBal
      : vaultBal;
  const qty = quantityForStake({
    stake,
    price: sizePrice,
    unit,
    lotSize: chosen.book.lotSize,
    minQuantity: chosen.book.minQuantity,
    cap: vaultBal,
    kind,
  });

  let postPrice = 0n;
  if (!iocOnly) {
    const postNative = postOnlyNative(nativeBid, nativeAsk, tick, sideLabel);
    postPrice = buyNo ? noToYes(postNative, unit) : postNative;
    if (postPrice <= 0n || (buyNo && postPrice >= unit)) {
      throw new Error("POST_ONLY YES price out of range after NO conversion");
    }
    const postCost = collateralCostForKind(kind, postPrice, qty, unit);
    if (postCost > vaultBal) throw new Error("vault collateral below POST_ONLY escrow");
  } else if (nativeAsk == null) {
    throw new Error(buyNo ? "IOC requested but noAsks empty" : "IOC requested but yesAsks empty");
  }

  const { encodeFunctionData } = await import("viem");

  async function attempt(attemptOpts: {
    label: string;
    price: bigint;
    orderType: number;
  }): Promise<AttemptResult> {
    const correlationId = `${correlationRoot}:${attemptOpts.label}`;
    const armData = encodeFunctionData({
      abi: vaultWriteAbi,
      functionName: "arm",
      args: [chosen!.marketId, kind, attemptOpts.price, qty, chosen!.expireNs, attemptOpts.orderType],
    });
    const armRcpt = await sendHttp(account, armData, { to: vault, gas: 10_000_000n });
    if (armRcpt.status !== "success") {
      throw new Error(`${attemptOpts.label} arm failed hash=${armRcpt.transactionHash}`);
    }
    const placeRcpt = await sendHttp(
      account,
      encodeFunctionData({ abi: vaultWriteAbi, functionName: "placeArmed" }),
      { to: vault, gas: PLACE_GAS },
    );
    const decoded = decodeFills(placeRcpt.logs);
    const reason = vaultRejectReason(placeRcpt.logs);
    const fillClass = classifyFill(qty, decoded.filled, decoded.placed);
    return {
      correlationId,
      marketId: chosen!.marketId,
      pool: chosen!.pool,
      nonce: chosen!.nonce.toString(),
      kind,
      orderType: attemptOpts.orderType,
      price: attemptOpts.price.toString(),
      quantity: qty.toString(),
      expireNs: chosen!.expireNs.toString(),
      armTx: armRcpt.transactionHash,
      placeTx: placeRcpt.transactionHash,
      placeStatus: placeRcpt.status,
      accepted: decoded.placed || decoded.filled > 0n,
      orderId: decoded.orderId?.toString() ?? null,
      filled: decoded.filled.toString(),
      fillClass,
      placedEvent: decoded.placed,
      fillLogCount: placeRcpt.logs.filter((l) => {
        try {
          return decodeEventLog({ abi: orderBookEventsAbi, data: l.data, topics: l.topics }).eventName === "OrderFilled";
        } catch {
          return false;
        }
      }).length,
      vaultReason: reason,
    };
  }

  const postOnly = iocOnly
    ? null
    : await attempt({ label: "POST_ONLY", price: postPrice, orderType: ORDER_TYPE.POST_ONLY });

  let ioc: AttemptResult | null = null;
  const needIoc =
    iocOnly ||
    (postOnly != null && postOnly.fillClass !== "FILL" && postOnly.fillClass !== "PARTIAL_FILL" && nativeAsk != null);
  if (needIoc && nativeAsk != null) {
    if (postOnly?.placedEvent && postOnly.orderId) {
      const cancelRcpt = await sendHttp(
        account,
        encodeFunctionData({ abi: vaultWriteAbi, functionName: "cancelLast" }),
        { to: vault, gas: 10_000_000n },
      );
      if (cancelRcpt.status !== "success") {
        writeEvidence(opts.evidenceName ?? "shannon-order.json", { postOnly, ioc: null, cancelFailed: cancelRcpt.transactionHash });
        return { postOnly, ioc: null, asset: chosen.asset, intervalSec: chosen.intervalSec };
      }
    }
    const iocNative = snapDown(nativeAsk, tick);
    const iocPrice = buyNo ? noToYes(iocNative, unit) : iocNative;
    const iocCost = collateralCostForKind(kind, iocPrice, qty, unit);
    if (iocCost <= vaultBal) {
      ioc = await attempt({ label: "IOC", price: iocPrice, orderType: ORDER_TYPE.MARKET });
    }
  }

  writeEvidence(opts.evidenceName ?? "shannon-order.json", {
    chainId: 50312,
    vault,
    correlationRoot,
    asset: chosen.asset,
    intervalSec: chosen.intervalSec,
    bias: opts.bias ?? null,
    kind,
    book: {
      tick: chosen.book.tickSize.toString(),
      lot: chosen.book.lotSize.toString(),
      minQuantity: chosen.book.minQuantity.toString(),
      bestBid: chosen.bestBid?.toString() ?? null,
      bestAsk: chosen.bestAsk?.toString() ?? null,
      bestNoBid: chosen.bestNoBid?.toString() ?? null,
      bestNoAsk: chosen.bestNoAsk?.toString() ?? null,
    },
    postOnly,
    ioc,
    note: "fillClass is from OrderFilled logs, never from receipt.status; BUY_NO price is YES-terms after unit-noPrice conversion",
  });
  return { postOnly, ioc, asset: chosen.asset, intervalSec: chosen.intervalSec };
}

export async function runLiveOrderFromKey(privateKey: Hex) {
  return runLiveOrder(privateKeyToAccount(privateKey));
}
