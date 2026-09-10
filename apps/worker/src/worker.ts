import { loadEnv, normalizePrivateKey } from "@relay/core";
import { migrate } from "@relay/db";
import { privateKeyToAccount } from "viem/accounts";
import { runWorkerLoop } from "./reconcile.js";

loadEnv();
const key = normalizePrivateKey(process.env.OPERATOR_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
await migrate();
const once = process.argv.includes("--once");
await runWorkerLoop(privateKeyToAccount(key), { once });
