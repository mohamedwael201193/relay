import { loadEnv, normalizePrivateKey } from "@relay/core";
import { migrate } from "@relay/db";
import { privateKeyToAccount } from "viem/accounts";
import { startApi } from "../apps/api/src/server.js";
import { runWorkerLoop } from "../apps/worker/src/reconcile.js";

loadEnv();
if (process.env.RELAY_RUN_WORKER !== "false") {
  process.env.RELAY_RUN_WORKER = "true";
}
startApi();

if (process.env.RELAY_RUN_WORKER === "false") {
  /* API only */
} else {
  const key = normalizePrivateKey(process.env.OPERATOR_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY);
  if (!key) {
    console.error("OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY missing");
    process.exit(1);
  }
  await migrate();
  await runWorkerLoop(privateKeyToAccount(key), { once: false });
}
