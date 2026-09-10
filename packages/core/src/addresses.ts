import type { Address, Hex } from "viem";
import {
  SOMNIA_MAINNET_ADDRESSES,
  SOMNIA_TESTNET_ADDRESSES,
} from "@somnia-chain/markets-sdk";

/** Pinned from @somnia-chain/markets-sdk@0.29.0 addresses.ts — re-verified 2026-09-10. */
export const SHANNON_CHAIN_ID = 50312;
export const MAINNET_CHAIN_ID = 5031;

export const REACTIVITY_PRECOMPILE = "0x0000000000000000000000000000000000000100" as Address;

export const SHANNON_ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
export const MAINNET_ADDRESSES = SOMNIA_MAINNET_ADDRESSES;

export function requiredAddress(value: Address | undefined, name: string): Address {
  if (!value) throw new Error(`missing address ${name}`);
  return value;
}

export const EXPECTED_SHANNON_DECIMALS = 6;
export const EXPECTED_MAINNET_DECIMALS = 18;

export const ANSWER_DELIVERED_TOPIC0 =
  "0x981074cb1e0ea7eac4cbc8c4c9ddbef8b964373e7e8cd0904c8e0951c4430541" as Hex;

export const DEFAULT_SHANNON_RPC = "https://dream-rpc.somnia.network";
export const DEFAULT_SHANNON_RPC_ALT = "https://api.infra.testnet.somnia.network";
export const DEFAULT_SHANNON_WS = "wss://api.infra.testnet.somnia.network/ws";
export const DEFAULT_MAINNET_RPC = "https://api.infra.mainnet.somnia.network";
export const DEFAULT_MAINNET_WS = "wss://api.infra.mainnet.somnia.network/ws";
export const DEFAULT_SHANNON_INDEXER = "https://dev.smk.somnia.host/v1/graphql";
export const DEFAULT_MAINNET_INDEXER = "https://prd.smk.somnia.host/v1/graphql";

export const CORE_CONTRACT_KEYS = [
  "binaryModule",
  "marketsCore",
  "binarySettlement",
  "oracleHub",
  "collateral",
  "collateralRouter",
  "clobFactory",
  "binaryPoolImpl",
  "binaryPoolBeacon",
  "marketCreator",
] as const;
