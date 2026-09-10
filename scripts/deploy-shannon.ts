import { deployShannon, loadEnv, normalizePrivateKey } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const deployed = await deployShannon(key);
console.log(`vault=${deployed.vault}`);
console.log(`registry=${deployed.registry}`);
console.log(`manager=${deployed.manager}`);
console.log(`txs=${deployed.txs.join(",")}`);
process.exit(0);
