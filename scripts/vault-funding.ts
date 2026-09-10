import { loadEnv, normalizePrivateKey, runVaultFunding } from "@relay/core";

loadEnv();
const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
if (!key) {
  console.error("DEPLOYER_PRIVATE_KEY missing");
  process.exit(1);
}
const evidence = await runVaultFunding(key);
console.log(JSON.stringify({
  vault: evidence.vault,
  depositTx: evidence.deposit.depositTx,
  withdrawTx: evidence.withdraw.withdrawTx,
  vaultAfter: evidence.snapshotAfter.vaultBal,
  scratch: evidence.scratch.scratch,
  killed: evidence.scratch.killed,
  depositBlocked: evidence.scratch.depositBlocked,
}));
process.exit(0);
