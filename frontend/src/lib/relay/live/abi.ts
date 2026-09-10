import { parseAbi } from "viem";

export const vaultWriteAbi = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function kill()",
  "function setOperatorNow(address next)",
  "function setCaps(uint256 budget_, uint256 perWindowCap_, uint256 maxDailyLoss_, uint256 maxOutstanding_)",
  "function setShieldsMax(uint8 max_)",
  "function approveOutcomeOperator(address token, bool approved)",
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function killed() view returns (bool)",
  "function budget() view returns (uint256)",
  "function maxDailyLoss() view returns (uint256)",
  "function realizedLossToday() view returns (uint256)",
  "function shieldCharges() view returns (uint8)",
  "function shieldsMax() view returns (uint8)",
]);

export const ownerMessage = (action: string, vault: string, timestamp: number) =>
  `RELAY ${action} vault ${vault.toLowerCase()} chain 50312 at ${timestamp}`;
