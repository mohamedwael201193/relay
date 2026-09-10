import { createPublicClient, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { DEFAULT_SHANNON_RPC, loadEnv, loadShannonDeployment, SHANNON_CHAIN_ID } from "@relay/core";
import { ownerMessage } from "../apps/api/src/ownerAuth.js";

loadEnv();

const API = (process.env.RELAY_ISOLATION_API ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const vaultKillAbi = parseAbi(["function kill()", "function withdraw(uint256 amount)", "function owner() view returns (address)"]);

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-relay-request-id": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`, { headers: { "x-relay-request-id": crypto.randomUUID() } });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const dep = loadShannonDeployment();
  const walletA = dep.deployer;
  const walletB = privateKeyToAccount(generatePrivateKey());
  const ts = Date.now();
  const startAsB = await walletB.signMessage({ message: ownerMessage("start", dep.vault, ts) });
  const stopAsB = await walletB.signMessage({ message: ownerMessage("stop", dep.vault, ts) });
  const pauseAsB = await walletB.signMessage({ message: ownerMessage("pause", dep.vault, ts) });

  const unsigned = await post(`/v1/runners/${dep.vault}/start`, {});
  const strangerStart = await post(`/v1/runners/${dep.vault}/start`, {
    timestamp: ts,
    signature: startAsB,
    owner: walletB.address,
  });
  const strangerStop = await post(`/v1/runners/${dep.vault}/stop`, {
    timestamp: ts,
    signature: stopAsB,
    owner: walletB.address,
  });
  const strangerPause = await post(`/v1/runners/${dep.vault}/pause`, {
    timestamp: ts,
    signature: pauseAsB,
    owner: walletB.address,
  });
  const listedA = await get(`/v1/runners?owner=${walletA}`);
  const listedB = await get(`/v1/runners?owner=${walletB.address}`);

  const pc = createPublicClient({
    chain: { id: SHANNON_CHAIN_ID, name: "shannon", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: [DEFAULT_SHANNON_RPC] } } },
    transport: http(DEFAULT_SHANNON_RPC, { timeout: 20_000 }),
  });
  const onchainOwner = await pc.readContract({ address: dep.vault, abi: vaultKillAbi, functionName: "owner" });
  let killSim: { ok: boolean; error?: string } = { ok: false };
  try {
    await pc.simulateContract({
      account: walletB.address,
      address: dep.vault,
      abi: vaultKillAbi,
      functionName: "kill",
    });
    killSim = { ok: true };
  } catch (e) {
    killSim = { ok: false, error: (e as Error).message.slice(0, 180) };
  }
  let withdrawSim: { ok: boolean; error?: string } = { ok: false };
  try {
    await pc.simulateContract({
      account: walletB.address,
      address: dep.vault,
      abi: vaultKillAbi,
      functionName: "withdraw",
      args: [1n],
    });
    withdrawSim = { ok: true };
  } catch (e) {
    withdrawSim = { ok: false, error: (e as Error).message.slice(0, 180) };
  }

  const aRunners = Array.isArray((listedA.json as { runners?: unknown[] }).runners)
    ? (listedA.json as { runners: { vault: string; owner: string }[] }).runners
    : [];
  const bRunners = Array.isArray((listedB.json as { runners?: unknown[] }).runners)
    ? (listedB.json as { runners: { vault: string; owner: string }[] }).runners
    : [];

  const out = {
    api: API,
    chainId: SHANNON_CHAIN_ID,
    vault: dep.vault,
    walletA,
    walletB: walletB.address,
    onchainOwner,
    unsignedStart: { status: unsigned.status, error: (unsigned.json as { error?: string }).error ?? null },
    strangerStart: { status: strangerStart.status, error: (strangerStart.json as { error?: string }).error ?? null },
    strangerStop: { status: strangerStop.status, error: (strangerStop.json as { error?: string }).error ?? null },
    strangerPause: { status: strangerPause.status, error: (strangerPause.json as { error?: string }).error ?? null },
    ownerARunnerCount: aRunners.length,
    ownerBRunnerCount: bRunners.length,
    ownerBSeesOwnerAVault: bRunners.some((r) => r.vault.toLowerCase() === dep.vault.toLowerCase()),
    killSimSucceeded: killSim.ok,
    killSimError: killSim.error ?? null,
    withdrawSimSucceeded: withdrawSim.ok,
    withdrawSimError: withdrawSim.error ?? null,
  };

  const pass =
    unsigned.status === 401 &&
    strangerStart.status === 403 &&
    strangerStop.status === 403 &&
    strangerPause.status === 403 &&
    bRunners.length === 0 &&
    !out.ownerBSeesOwnerAVault &&
    !out.killSimSucceeded &&
    !out.withdrawSimSucceeded &&
    String(onchainOwner).toLowerCase() === walletA.toLowerCase();

  console.log(JSON.stringify({ ok: pass, ...out }, null, 2));
  if (!pass) process.exit(1);
}

await main();
