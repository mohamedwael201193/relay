import { randomUUID } from "node:crypto";
import { decodeEventLog, parseAbi, type Address, type Hex, type Log } from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { ORDER_KIND, ORDER_TYPE, orderBookEventsAbi } from "@somnia-chain/markets-sdk";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { binaryPoolReadAbi } from "./abis.js";
import { createExchange } from "./exchange.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { classifyFill, snapDown, snapQuantity } from "./quant.js";
import { shannonHttpClient } from "./sendHttp.js";
import { sendHttp } from "./sendHttp.js";
import { loadShannonDeployment, writeEvidence } from "./vaultOps.js";
import { erc20Balance } from "./rpc.js";

const MODULE = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
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

export async function runLiveOrder(account: LocalAccount): Promise<{
  postOnly: AttemptResult;
  ioc: AttemptResult | null;
}> {
  const dep = loadShannonDeployment();
  const client = shannonHttpClient();
  const exchange = createExchange("shannon");
  const correlationRoot = randomUUID();
  const live = await exchange.client.listLiveBinaryMarkets({ limit: 25 });

  let chosen: {
    marketId: Hex;
    pool: Address;
    book: { tickSize: bigint; lotSize: bigint; minQuantity: bigint };
    bestBid: bigint | null;
    bestAsk: bigint | null;
    expireNs: bigint;
    nonce: bigint;
    decimals: number;
  } | null = null;

  for (const m of live) {
    if (!m.marketId || !m.poolAddress) continue;
    const onchain = await getMarketOnchainHttp(client, MODULE, m.marketId as Hex);
    if (onchain.statusLabel !== "Trading") continue;
    if (onchain.collateral.toLowerCase() !== COLLATERAL.toLowerCase()) continue;
    if (onchain.pool === "0x0000000000000000000000000000000000000000") continue;
    const book = await getBinaryBookParamsHttp(client, onchain.pool);
    let expireNs = 0n;
    try {
      expireNs = await client.readContract({
        address: onchain.pool,
        abi: binaryPoolReadAbi,
        functionName: "marketExpiryNs",
      });
    } catch {
      continue;
    }
    if (expireNs === 0n) continue;
    let bestBid: bigint | null = null;
    let bestAsk: bigint | null = null;
    try {
      const ob = await exchange.client.getBinaryOrderBook(m.poolAddress);
      bestBid = ob.yesBids?.[0]?.price != null ? BigInt(ob.yesBids[0].price) : null;
      bestAsk = ob.yesAsks?.[0]?.price != null ? BigInt(ob.yesAsks[0].price) : null;
    } catch {
      continue;
    }
    if (bestBid == null && bestAsk == null) continue;
    chosen = {
      marketId: m.marketId as Hex,
      pool: onchain.pool,
      book,
      bestBid,
      bestAsk,
      expireNs,
      nonce: onchain.nonce,
      decimals: onchain.decimals,
    };
    break;
  }

  if (!chosen) {
    throw new Error("no live Trading market with on-chain book and non-zero marketExpiryNs");
  }

  const qty = snapQuantity(chosen.book.minQuantity, chosen.book.lotSize, chosen.book.minQuantity);
  const tick = chosen.book.tickSize;
  let postPrice = chosen.bestBid ?? (chosen.bestAsk != null ? chosen.bestAsk - tick : 0n);
  postPrice = snapDown(postPrice, tick);
  if (postPrice < tick) postPrice = tick;
  if (chosen.bestAsk != null && postPrice >= chosen.bestAsk) {
    postPrice = snapDown(chosen.bestAsk - tick, tick);
  }
  if (postPrice < tick) {
    throw new Error("POST_ONLY price collapsed below tick (empty/locked book)");
  }

  const vaultBal = await erc20Balance(client, COLLATERAL, dep.vault);
  const unit = 10n ** BigInt(chosen.decimals);
  const postCost = (postPrice * qty + unit - 1n) / unit;
  if (postCost > vaultBal) throw new Error("vault collateral below POST_ONLY escrow");

  const { encodeFunctionData } = await import("viem");

  async function attempt(opts: {
    label: string;
    price: bigint;
    orderType: number;
  }): Promise<AttemptResult> {
    const correlationId = `${correlationRoot}:${opts.label}`;
    const armData = encodeFunctionData({
      abi: vaultWriteAbi,
      functionName: "arm",
      args: [chosen!.marketId, ORDER_KIND.BUY_YES, opts.price, qty, chosen!.expireNs, opts.orderType],
    });
    const armRcpt = await sendHttp(account, armData, { to: dep.vault, gas: 10_000_000n });
    if (armRcpt.status !== "success") {
      throw new Error(`${opts.label} arm failed hash=${armRcpt.transactionHash}`);
    }
    const placeRcpt = await sendHttp(
      account,
      encodeFunctionData({ abi: vaultWriteAbi, functionName: "placeArmed" }),
      { to: dep.vault, gas: PLACE_GAS },
    );
    const decoded = decodeFills(placeRcpt.logs);
    const reason = vaultRejectReason(placeRcpt.logs);
    const fillClass = classifyFill(qty, decoded.filled, decoded.placed);
    return {
      correlationId,
      marketId: chosen!.marketId,
      pool: chosen!.pool,
      nonce: chosen!.nonce.toString(),
      kind: ORDER_KIND.BUY_YES,
      orderType: opts.orderType,
      price: opts.price.toString(),
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

  const postOnly = await attempt({ label: "POST_ONLY", price: postPrice, orderType: ORDER_TYPE.POST_ONLY });

  let ioc: AttemptResult | null = null;
  if (postOnly.fillClass !== "FILL" && postOnly.fillClass !== "PARTIAL_FILL" && chosen.bestAsk != null) {
    if (postOnly.placedEvent && postOnly.orderId) {
      const cancelRcpt = await sendHttp(
        account,
        encodeFunctionData({ abi: vaultWriteAbi, functionName: "cancelLast" }),
        { to: dep.vault, gas: 10_000_000n },
      );
      if (cancelRcpt.status !== "success") {
        writeEvidence("shannon-order.json", { postOnly, ioc: null, cancelFailed: cancelRcpt.transactionHash });
        return { postOnly, ioc: null };
      }
    }
    const iocPrice = snapDown(chosen.bestAsk, tick);
    const iocCost = (iocPrice * qty + unit - 1n) / unit;
    if (iocCost <= vaultBal) {
      ioc = await attempt({ label: "IOC", price: iocPrice, orderType: ORDER_TYPE.MARKET });
    }
  }

  writeEvidence("shannon-order.json", {
    chainId: 50312,
    vault: dep.vault,
    correlationRoot,
    book: {
      tick: chosen.book.tickSize.toString(),
      lot: chosen.book.lotSize.toString(),
      minQuantity: chosen.book.minQuantity.toString(),
      bestBid: chosen.bestBid?.toString() ?? null,
      bestAsk: chosen.bestAsk?.toString() ?? null,
    },
    postOnly,
    ioc,
    note: "fillClass is from OrderFilled logs, never from receipt.status",
  });
  return { postOnly, ioc };
}

export async function runLiveOrderFromKey(privateKey: Hex) {
  return runLiveOrder(privateKeyToAccount(privateKey));
}
