import { loadEnv, normalizePrivateKey, settleFilledMarketFromKey } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const marketId = (process.argv[2] ??
  "0x00000000000000000000000000000000000000000000000000000000000189a7") as `0x${string}`;
const out = await settleFilledMarketFromKey(key, marketId);
console.log(JSON.stringify({
  statusBefore: out.statusBefore,
  statusAfter: out.statusAfter,
  resolved: out.resolved,
  voided: out.voided,
  yesBal: out.yesBal,
  noBal: out.noBal,
  redeemed: out.redeemed,
  redeemTx: out.redeemTx,
  vaultCollateralAfter: out.vaultCollateralAfter,
}));
process.exit(0);
