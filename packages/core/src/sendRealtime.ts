import {
  createPublicClient,
  encodeDeployData,
  formatTransactionReceipt,
  parseGwei,
  webSocket,
  type Abi,
  type Hex,
  type TransactionReceipt,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { DEFAULT_SHANNON_WS } from "./addresses.js";
import { envString } from "./env.js";

const GAS = 10_000_000n;
const MAX_FEE = parseGwei("60");
const PRIORITY = parseGwei("60");

export function shannonWsClient() {
  const url = envString("SOMNIA_SHANNON_WS_URL", DEFAULT_SHANNON_WS)!;
  return createPublicClient({
    chain: somniaShannon,
    transport: webSocket(url),
  });
}

export async function sendRealtime(
  account: LocalAccount,
  data: Hex,
  to?: Hex,
): Promise<TransactionReceipt> {
  const client = shannonWsClient();
  try {
    const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
    const serialized = await account.signTransaction({
      type: "eip1559",
      chainId: somniaShannon.id,
      nonce,
      gas: GAS,
      maxFeePerGas: MAX_FEE,
      maxPriorityFeePerGas: PRIORITY,
      data,
      ...(to ? { to } : {}),
      value: 0n,
    });
    const raw = await client.request({
      method: "realtime_sendRawTransaction" as never,
      params: [serialized] as never,
    });
    if (raw == null) throw new Error("realtime_sendRawTransaction returned no receipt");
    return formatTransactionReceipt(raw as never);
  } finally {
    try {
      (client as { close?: () => Promise<void> }).close?.();
    } catch {
      /* ignore */
    }
  }
}

export function encodeCreate(abi: Abi, bytecode: Hex, args: readonly unknown[]): Hex {
  return encodeDeployData({ abi, bytecode, args });
}
