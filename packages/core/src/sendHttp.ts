import {
  createPublicClient,
  formatEther,
  http,
  parseGwei,
  type Hex,
  type TransactionReceipt,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { DEFAULT_SHANNON_RPC } from "./addresses.js";
import { envString } from "./env.js";

/** Official Somnia bytecode deposit cost. https://docs.somnia.network/developer/deployment-and-production/somnia-gas-differences-to-ethereum */
export const SOMNIA_CODE_GAS_PER_BYTE = 3125n;

const CREATE_BASE = 8_000_000n;
const CREATE_HEADROOM = 25_000_000n;
const CREATE_MIN = 40_000_000n;
const CREATE_MAX = 150_000_000n;

const CALL_GAS = 5_000_000n;
const MAX_FEE = parseGwei("20");
const PRIORITY = parseGwei("6");

export function somniaCreateGas(deployedBytecode: Hex): bigint {
  const bytes = BigInt(Math.max(0, (deployedBytecode.length - 2) / 2));
  const gas = CREATE_BASE + SOMNIA_CODE_GAS_PER_BYTE * bytes + CREATE_HEADROOM;
  if (gas < CREATE_MIN) return CREATE_MIN;
  if (gas > CREATE_MAX) return CREATE_MAX;
  return gas;
}

export function shannonHttpClient() {
  const url = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
  return createPublicClient({
    chain: somniaShannon,
    transport: http(url, { timeout: 120_000 }),
  });
}

export async function sendHttp(
  account: LocalAccount,
  data: Hex,
  opts: { to?: Hex; gas: bigint; value?: bigint },
): Promise<TransactionReceipt> {
  const client = shannonHttpClient();
  const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
  const serialized = await account.signTransaction({
    type: "eip1559",
    chainId: somniaShannon.id,
    nonce,
    gas: opts.gas,
    maxFeePerGas: MAX_FEE,
    maxPriorityFeePerGas: PRIORITY,
    data,
    ...(opts.to ? { to: opts.to } : {}),
    value: opts.value ?? 0n,
  });
  const hash = await client.sendRawTransaction({ serializedTransaction: serialized });
  return client.waitForTransactionReceipt({ hash, timeout: 180_000 });
}

export async function assertDeployBudget(account: LocalAccount, gas: bigint): Promise<void> {
  const client = shannonHttpClient();
  const bal = await client.getBalance({ address: account.address });
  const need = gas * MAX_FEE;
  if (bal < need) {
    throw new Error(
      `deploy budget FAIL: native=${formatEther(bal)} STT need<=${formatEther(need)} STT for gas=${gas} (key not logged)`,
    );
  }
}
