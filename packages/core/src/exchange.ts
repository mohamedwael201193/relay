import {
  SomniaMarkets,
  SOMNIA_MAINNET_ADDRESSES,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaMainnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { Hex } from "viem";
import {
  DEFAULT_MAINNET_INDEXER,
  DEFAULT_MAINNET_WS,
  DEFAULT_SHANNON_INDEXER,
  DEFAULT_SHANNON_WS,
} from "./addresses.js";
import { envString } from "./env.js";

export type NetworkName = "shannon" | "mainnet";

export function createExchange(network: NetworkName, privateKey?: Hex): SomniaMarkets {
  if (network === "shannon") {
    return new SomniaMarkets({
      indexerUrl: envString("SHANNON_INDEXER_URL", DEFAULT_SHANNON_INDEXER)!,
      chain: somniaShannon,
      wsRpcUrl: envString("SOMNIA_SHANNON_WS_URL", DEFAULT_SHANNON_WS),
      addresses: SOMNIA_TESTNET_ADDRESSES,
      priceFeed: SOMNIA_TESTNET_PRICE_FEED,
      privateKey,
    });
  }
  return new SomniaMarkets({
    indexerUrl: envString("MAINNET_INDEXER_URL", DEFAULT_MAINNET_INDEXER)!,
    chain: somniaMainnet,
    wsRpcUrl: envString("SOMNIA_MAINNET_WS_URL", DEFAULT_MAINNET_WS),
    addresses: SOMNIA_MAINNET_ADDRESSES,
    privateKey,
  });
}
