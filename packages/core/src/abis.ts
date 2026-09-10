import { parseAbi } from "viem";

/** Pinned fragments from @somnia-chain/markets-sdk@0.29.0 src/readsAbi.ts (not all exported at package root). */
export const binaryPoolReadAbi = parseAbi([
  "function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))",
  "function marketExpiryNs() view returns (uint64)",
]);

export const binaryMarketReadAbi = parseAbi([
  "function outcomeToken() view returns (address)",
  "function status() view returns (uint8)",
  "function backing() view returns (uint256)",
  "function expiry() view returns (uint64)",
  "function settlementWindow() view returns (uint64)",
  "function payoutNumerators() view returns (uint256[])",
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
  "function voidPolicy() view returns (uint8)",
]);
