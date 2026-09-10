import { binaryModuleReadAbi } from "@somnia-chain/markets-sdk";
import type { Address, Hex, PublicClient } from "viem";
import { binaryMarketReadAbi, binaryPoolReadAbi } from "./abis.js";
import { erc20Decimals } from "./rpc.js";

export const MARKET_STATUS = {
  Listed: 0,
  Trading: 1,
  Locked: 2,
  Settling: 3,
  Resolved: 4,
  Voided: 5,
} as const;

export function statusName(status: number): string {
  const entry = Object.entries(MARKET_STATUS).find(([, v]) => v === status);
  return entry ? entry[0] : `unknown(${status})`;
}

export type BookParams = {
  tickSize: bigint;
  lotSize: bigint;
  minQuantity: bigint;
};

export async function getBinaryBookParamsHttp(
  client: PublicClient,
  pool: Address,
): Promise<BookParams> {
  const p = await client.readContract({
    address: pool,
    abi: binaryPoolReadAbi,
    functionName: "getOrderBookParameters",
  });
  return { tickSize: p.tickSize, minQuantity: p.minQuantity, lotSize: p.lotSize };
}

/** HTTP equivalent of SDK getMarketOnchain — doctor/write-gate must not depend on WS. */
export async function getMarketOnchainHttp(
  client: PublicClient,
  module: Address,
  marketId: Hex,
): Promise<{
  oracleQuestionId: bigint;
  collateral: Address;
  originVenueId: Hex;
  market: Address;
  pool: Address;
  yesId: bigint;
  noId: bigint;
  tradingStart: bigint;
  expiry: bigint;
  settlementWindow: bigint;
  nonce: bigint;
  status: number;
  statusLabel: string;
  isResolved: boolean;
  isVoided: boolean;
  payoutNumerators: readonly bigint[];
  voidPolicy: number | null;
  decimals: number;
}> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error("marketId must be bytes32");
  }
  const [rec, nonce] = await Promise.all([
    client.readContract({
      address: module,
      abi: binaryModuleReadAbi,
      functionName: "markets",
      args: [marketId],
    }),
    client.readContract({
      address: module,
      abi: binaryModuleReadAbi,
      functionName: "marketNonce",
      args: [marketId],
    }),
  ]);
  const collateral = rec[3];
  const market = rec[8];
  const pool = rec[9];
  if (market === "0x0000000000000000000000000000000000000000") {
    throw new Error("unknown marketId on module");
  }
  const [status, payoutNumerators, isResolved, isVoided, decimals, voidPolicy, settlementWindow] =
    await Promise.all([
      client.readContract({ address: market, abi: binaryMarketReadAbi, functionName: "status" }),
      client.readContract({
        address: market,
        abi: binaryMarketReadAbi,
        functionName: "payoutNumerators",
      }),
      client.readContract({ address: market, abi: binaryMarketReadAbi, functionName: "isResolved" }),
      client.readContract({ address: market, abi: binaryMarketReadAbi, functionName: "isVoided" }),
      erc20Decimals(client, collateral),
      client
        .readContract({ address: market, abi: binaryMarketReadAbi, functionName: "voidPolicy" })
        .then((v) => Number(v))
        .catch(() => null),
      client.readContract({
        address: market,
        abi: binaryMarketReadAbi,
        functionName: "settlementWindow",
      }),
    ]);
  return {
    oracleQuestionId: rec[0],
    collateral,
    originVenueId: rec[5],
    market,
    pool,
    yesId: rec[10],
    noId: rec[11],
    tradingStart: rec[12],
    expiry: rec[13],
    settlementWindow,
    nonce,
    status: Number(status),
    statusLabel: statusName(Number(status)),
    isResolved,
    isVoided,
    payoutNumerators,
    voidPolicy,
    decimals,
  };
}
