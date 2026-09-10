import { loadEnv, normalizePrivateKey, runShannonFaucet } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}

const result = await runShannonFaucet(key);
console.log(`address=${result.address}`);
console.log(`before STT=${result.before.stt} tUSDC=${result.before.tusdc}`);
console.log(`faucetTx=${result.hash} status=${result.status}`);
console.log(`after STT=${result.after.stt} tUSDC=${result.after.tusdc}`);
process.exit(result.status === "success" ? 0 : 1);
