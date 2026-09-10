import { loadEnv, normalizePrivateKey, writeEvidence } from "@relay/core";
import { migrate } from "@relay/db";
import { privateKeyToAccount } from "viem/accounts";
import { reconcileOnce } from "../apps/worker/src/reconcile.js";

loadEnv();
const key = normalizePrivateKey(process.env.OPERATOR_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
await migrate();
const account = privateKeyToAccount(key);
const ticks = Number(process.env.SOAK_TICKS ?? 3);
const ticksOut: unknown[] = [];
for (let i = 0; i < ticks; i++) {
  const out = await reconcileOnce(account);
  ticksOut.push({ i, ...out, at: new Date().toISOString() });
  console.log(JSON.stringify({ soakTick: i, ...out }));
}
writeEvidence("shannon-soak.json", {
  chainId: 50312,
  ticks: ticksOut,
  note: "local soak of the same reconcileOnce path Render would run on boot/restart",
});
const placedOrSettled = ticksOut.some((t) => {
  const a = (t as { action?: string }).action;
  return a === "filled" || a === "placed" || a === "settled" || a === "redeemed";
});
process.exit(placedOrSettled ? 0 : 2);
