import { spawnSync } from "node:child_process";
import { loadEnv, normalizePrivateKey, envString, DEFAULT_SHANNON_RPC } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) process.exit(1);
const rpc = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
const forge = "d:\\route\\relay\\.vendor\\foundry\\forge.exe";
const r = spawnSync(
  forge,
  [
    "create",
    "contracts/src/RelayRegistry.sol:RelayRegistry",
    "--rpc-url",
    rpc,
    "--private-key",
    key,
    "--broadcast",
    "--gas-limit",
    "80000000",
    "--with-gas-price",
    "12000000000",
  ],
  { encoding: "utf8" },
);
if (r.stdout) console.log(r.stdout.replaceAll(key, "[redacted]"));
if (r.stderr) console.error(r.stderr.replaceAll(key, "[redacted]"));
process.exit(r.status ?? 1);
