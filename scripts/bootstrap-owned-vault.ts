/**
 * Owner bootstrap for a vault this key already owns: fund, operator, shields, start.
 * Used to finish Boost child lifecycle without a Chrome second wallet.
 */
import { privateKeyToAccount } from "viem/accounts";
import {
  fundVault,
  loadEnv,
  loadShannonDeployment,
  normalizePrivateKey,
  readVaultSnapshot,
  setVaultOperator,
  setVaultShieldsMax,
} from "@relay/core";
import { ownerMessage } from "../apps/api/src/ownerAuth.js";

loadEnv();
const vault = String(process.argv[2] ?? "").toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(vault)) {
  console.error("usage: tsx scripts/bootstrap-owned-vault.ts <vault>");
  process.exit(1);
}
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const account = privateKeyToAccount(key);
const dep = loadShannonDeployment();
const api = (process.env.RELAY_API_URL ?? "https://relay-api-71gi.onrender.com").replace(/\/$/, "");
const snap0 = await readVaultSnapshot(vault as `0x${string}`);
if (snap0.owner.toLowerCase() !== account.address.toLowerCase()) {
  console.error(`not_owner have=${snap0.owner} want=${account.address}`);
  process.exit(1);
}
const need = 10_000_000n;
const have = BigInt(snap0.vaultBal);
const funded =
  have >= need
    ? { skipped: true as const, vaultAfter: snap0.vaultBal }
    : await fundVault(account, vault as `0x${string}`, need - have);
const op =
  snap0.operator.toLowerCase() === dep.deployer.toLowerCase()
    ? { skipped: true as const, tx: null }
    : await setVaultOperator(account, vault as `0x${string}`, dep.deployer);
const shields =
  snap0.shieldsMax > 0
    ? { skipped: true as const, tx: null, shieldsMax: snap0.shieldsMax }
    : await setVaultShieldsMax(account, vault as `0x${string}`, 2);
const timestamp = Date.now();
const signature = await account.signMessage({
  message: ownerMessage("start", vault, timestamp),
});
const startRes = await fetch(`${api}/v1/runners/${vault}/start`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ timestamp, signature, owner: account.address }),
});
const startText = await startRes.text();
const snap1 = await readVaultSnapshot(vault as `0x${string}`);
console.log(
  JSON.stringify(
    {
      vault,
      owner: snap1.owner,
      operator: snap1.operator,
      vaultBal: snap1.vaultBal,
      shieldCharges: snap1.shieldCharges,
      shieldsMax: snap1.shieldsMax,
      funded,
      operatorTx: "tx" in op ? op.tx : null,
      shieldsTx: "tx" in shields ? shields.tx : null,
      startHttp: startRes.status,
      startBody: startText.slice(0, 400),
    },
    null,
    2,
  ),
);
process.exit(startRes.ok ? 0 : 1);
