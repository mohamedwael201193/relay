/**
 * Second-owner vault lifecycle against the live API + Shannon.
 * Does not touch the ops soak vault. Never logs private keys.
 */
import {
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  fundVault,
  loadEnv,
  loadShannonDeployment,
  normalizePrivateKey,
  readVaultSnapshot,
  SHANNON_ADDRESSES,
  withdrawVault,
  writeEvidence,
} from "@relay/core";
import { sendHttp } from "../packages/core/src/sendHttp.js";
import { ownerMessage } from "../apps/api/src/ownerAuth.js";

loadEnv();

const API = (process.env.RELAY_ISOLATION_API ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const COLLATERAL = SHANNON_ADDRESSES.collateral as Address;
const DEPOSIT = 5_000_000n;
const TRANSFER = 8_000_000n;
const vaultKillAbi = parseAbi(["function kill()"]);

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-relay-request-id": crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 240) };
  }
  return { status: res.status, json };
}

async function auth(account: ReturnType<typeof privateKeyToAccount>, action: string, vault: string) {
  const timestamp = Date.now();
  const signature = await account.signMessage({ message: ownerMessage(action as never, vault, timestamp) });
  return { timestamp, signature, owner: account.address };
}

async function main() {
  const dep = loadShannonDeployment();
  const deployerKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY missing");
  const deployer = privateKeyToAccount(deployerKey);
  const walletB = privateKeyToAccount(generatePrivateKey());

  const sttTx = await sendHttp(deployer, "0x", {
    to: walletB.address as Hex,
    gas: 1_000_000n,
    value: parseEther("0.25"),
  });
  if (sttTx.status !== "success") throw new Error(`stt transfer failed ${sttTx.transactionHash}`);

  const tusdcTx = await sendHttp(
    deployer,
    encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [walletB.address, TRANSFER] }),
    { to: COLLATERAL, gas: 5_000_000n },
  );
  if (tusdcTx.status !== "success") throw new Error(`tusdc transfer failed ${tusdcTx.transactionHash}`);

  const provisionAuth = await auth(walletB, "provision", "new");
  const provisioned = await api("POST", "/v1/runners/provision", {
    ...provisionAuth,
    budget: 10,
    stopLoss: 5,
  });
  if (provisioned.status !== 200) {
    throw new Error(`provision failed ${provisioned.status} ${JSON.stringify(provisioned.json)}`);
  }
  const vault = String((provisioned.json as { vault: string }).vault) as Address;
  const deployTx = String((provisioned.json as { deployTx: string }).deployTx);

  const deposit = await fundVault(walletB, vault, DEPOSIT);
  const start = await api("POST", `/v1/runners/${vault}/start`, await auth(walletB, "start", vault));
  if (start.status !== 200) throw new Error(`start failed ${start.status} ${JSON.stringify(start.json)}`);

  const killRcpt = await sendHttp(
    walletB,
    encodeFunctionData({ abi: vaultKillAbi, functionName: "kill" }),
    { to: vault, gas: 5_000_000n },
  );
  if (killRcpt.status !== "success") throw new Error(`kill failed ${killRcpt.transactionHash}`);
  const stop = await api("POST", `/v1/runners/${vault}/stop`, await auth(walletB, "stop", vault));

  const snapAfterKill = await readVaultSnapshot(vault);
  const withdraw = await withdrawVault(walletB, vault, BigInt(snapAfterKill.vaultBal));
  const snapAfterWithdraw = await readVaultSnapshot(vault);

  const listedA = await api("GET", `/v1/runners?owner=${dep.deployer}`);
  const listedB = await api("GET", `/v1/runners?owner=${walletB.address}`);
  const aRunners = ((listedA.json as { runners?: { vault: string; owner: string }[] }).runners ?? []);
  const bRunners = ((listedB.json as { runners?: { vault: string; owner: string }[] }).runners ?? []);

  const strangerStart = await api("POST", `/v1/runners/${dep.vault}/start`, await auth(walletB, "start", dep.vault));

  const out = {
    api: API,
    walletA: dep.deployer,
    walletB: walletB.address,
    opsVault: dep.vault,
    vault,
    deployTx,
    sttTx: sttTx.transactionHash,
    tusdcTx: tusdcTx.transactionHash,
    approveTx: deposit.approveTx,
    depositTx: deposit.depositTx,
    start: { status: start.status, json: start.json },
    killTx: killRcpt.transactionHash,
    stop: { status: stop.status, json: stop.json },
    withdrawTx: withdraw.withdrawTx,
    killed: snapAfterKill.killed,
    vaultBalAfterWithdraw: snapAfterWithdraw.vaultBal,
    ownerARunnerVaults: aRunners.map((r) => r.vault),
    ownerBRunnerVaults: bRunners.map((r) => r.vault),
    aSeesB: aRunners.some((r) => r.vault.toLowerCase() === vault.toLowerCase()),
    bSeesOps: bRunners.some((r) => r.vault.toLowerCase() === dep.vault.toLowerCase()),
    bSeesOwn: bRunners.some((r) => r.vault.toLowerCase() === vault.toLowerCase()),
    strangerStartOnOps: { status: strangerStart.status, error: (strangerStart.json as { error?: string }).error ?? null },
  };

  const pass =
    out.killed === true &&
    out.vaultBalAfterWithdraw === "0" &&
    out.aSeesB === false &&
    out.bSeesOps === false &&
    out.bSeesOwn === true &&
    out.strangerStartOnOps.status === 403 &&
    out.start.status === 200 &&
    killRcpt.status === "success";

  writeEvidence("owner-b-lifecycle.json", { ...out, pass });
  console.log(JSON.stringify({ ...out, pass }, null, 2));
  if (!pass) process.exit(1);
}

await main();
