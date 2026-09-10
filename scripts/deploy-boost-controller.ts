import { privateKeyToAccount } from "viem/accounts";
import {
  deployBoostController,
  extractBoostControllerArtifact,
  loadEnv,
  normalizePrivateKey,
  persistBoostControllerPin,
} from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
extractBoostControllerArtifact();
const deployed = await deployBoostController(privateKeyToAccount(key));
persistBoostControllerPin(deployed.controller, deployed.tx, deployed.gasUsed);
console.log(`boostController=${deployed.controller}`);
console.log(`tx=${deployed.tx}`);
console.log(`gasUsed=${deployed.gasUsed}`);
process.exit(0);
