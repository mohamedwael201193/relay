import { loadEnv, normalizePrivateKey, runLiveOrderFromKey } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const out = await runLiveOrderFromKey(key);
console.log(JSON.stringify({
  postOnly: {
    correlationId: out.postOnly.correlationId,
    marketId: out.postOnly.marketId,
    placeTx: out.postOnly.placeTx,
    fillClass: out.postOnly.fillClass,
    filled: out.postOnly.filled,
    placedEvent: out.postOnly.placedEvent,
    vaultReason: out.postOnly.vaultReason,
    receiptStatus: out.postOnly.placeStatus,
  },
  ioc: out.ioc
    ? {
        correlationId: out.ioc.correlationId,
        placeTx: out.ioc.placeTx,
        fillClass: out.ioc.fillClass,
        filled: out.ioc.filled,
        placedEvent: out.ioc.placedEvent,
        vaultReason: out.ioc.vaultReason,
        receiptStatus: out.ioc.placeStatus,
      }
    : null,
}));
process.exit(0);
