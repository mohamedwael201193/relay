import { loadEnv, normalizePrivateKey, runGoldE2e } from "@relay/core";
import { migrate, persistGoldE2e } from "@relay/db";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
await migrate();
const out = await runGoldE2e(key);
try {
  const persisted = await persistGoldE2e(out);
  console.log(JSON.stringify({
    lap1: out.lap1,
    wait: out.wait,
    settlement: out.settlement,
    lap2: out.lap2,
    autonomous: out.autonomous,
    subscriptionId: out.subscriptionId,
    registerTx: out.registerTx,
    runnerId: persisted.runnerId,
  }));
} catch (e) {
  console.log(JSON.stringify({
    lap1: out.lap1,
    wait: out.wait,
    settlement: out.settlement,
    lap2: out.lap2,
    autonomous: out.autonomous,
    subscriptionId: out.subscriptionId,
    registerTx: out.registerTx,
    persistError: (e as Error).message,
  }));
}
process.exit(out.autonomous ? 0 : 2);
