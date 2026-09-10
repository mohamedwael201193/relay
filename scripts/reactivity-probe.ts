import { loadEnv, normalizePrivateKey, runReactivityProbe } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const out = await runReactivityProbe(key);
console.log(JSON.stringify({
  probe: out.probe,
  subscriptionId: out.subscriptionId,
  hits: out.hits,
  lastMsgSender: out.lastMsgSender,
  lastEmitter: out.lastEmitter,
  callbackVerified: out.callbackVerified,
  deployTx: out.deployTx,
  armTx: out.armTx,
}));
process.exit(0);
