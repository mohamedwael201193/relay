import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeFunctionData, parseAbi, parseEther, formatEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { encodeCreate } from "./sendRealtime.js";
import { sendHttp, shannonHttpClient, somniaCreateGas, assertDeployBudget } from "./sendHttp.js";
import { writeEvidence } from "./vaultOps.js";
import { REACTIVITY_PRECOMPILE } from "./addresses.js";

const probeAbi = parseAbi([
  "function owner() view returns (address)",
  "function hits() view returns (uint256)",
  "function lastEmitter() view returns (address)",
  "function lastMsgSender() view returns (address)",
  "function lastTopic0() view returns (bytes32)",
  "function subscriptionId() view returns (uint256)",
  "function armedBlock() view returns (uint64)",
  "function lastBlock() view returns (uint64)",
  "function subscribeNextBlock() returns (uint256)",
  "function cancel()",
  "function withdrawNative(uint256 amount)",
]);

function loadArtifact() {
  const p = resolve(process.cwd(), "contracts/out/ReactivityProbe.sol/ReactivityProbe.json");
  return JSON.parse(readFileSync(p, "utf8")) as {
    abi: never;
    bytecode: { object: Hex };
    deployedBytecode: { object: Hex };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runReactivityProbe(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const client = shannonHttpClient();
  const nativeBefore = await client.getBalance({ address: account.address });
  const stake = parseEther("33");
  if (nativeBefore < stake + parseEther("1")) {
    throw new Error(`native too low for 32 STT reactivity stake (balance not logged)`);
  }

  const art = loadArtifact();
  const gas = somniaCreateGas(art.deployedBytecode.object);
  await assertDeployBudget(account, gas);
  const createRcpt = await sendHttp(account, encodeCreate(art.abi, art.bytecode.object, []), { gas });
  if (createRcpt.status !== "success" || !createRcpt.contractAddress) {
    throw new Error(`probe deploy failed hash=${createRcpt.transactionHash}`);
  }
  const probe = createRcpt.contractAddress;

  const fund = await sendHttp(account, "0x", { to: probe, gas: 5_000_000n, value: stake });
  if (fund.status !== "success") throw new Error(`probe fund failed hash=${fund.transactionHash}`);

  const arm = await sendHttp(
    account,
    encodeFunctionData({ abi: probeAbi, functionName: "subscribeNextBlock" }),
    { to: probe, gas: 10_000_000n },
  );
  if (arm.status !== "success") throw new Error(`subscribeNextBlock failed hash=${arm.transactionHash}`);

  const subId = await client.readContract({ address: probe, abi: probeAbi, functionName: "subscriptionId" });
  const armedBlock = await client.readContract({ address: probe, abi: probeAbi, functionName: "armedBlock" });
  const probeBal = await client.getBalance({ address: probe });

  let hits = 0n;
  let lastMsgSender = "0x0000000000000000000000000000000000000000";
  let lastEmitter = "0x0000000000000000000000000000000000000000";
  let lastTopic0 = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let lastBlock = 0n;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    hits = await client.readContract({ address: probe, abi: probeAbi, functionName: "hits" });
    if (hits > 0n) {
      lastMsgSender = await client.readContract({ address: probe, abi: probeAbi, functionName: "lastMsgSender" });
      lastEmitter = await client.readContract({ address: probe, abi: probeAbi, functionName: "lastEmitter" });
      lastTopic0 = await client.readContract({ address: probe, abi: probeAbi, functionName: "lastTopic0" });
      lastBlock = await client.readContract({ address: probe, abi: probeAbi, functionName: "lastBlock" });
      break;
    }
  }

  const callbackVerified =
    hits > 0n && lastMsgSender.toLowerCase() === REACTIVITY_PRECOMPILE.toLowerCase();

  const cancel = await sendHttp(
    account,
    encodeFunctionData({ abi: probeAbi, functionName: "cancel" }),
    { to: probe, gas: 10_000_000n },
  );
  const leftover = await client.getBalance({ address: probe });
  const withdraw = await sendHttp(
    account,
    encodeFunctionData({ abi: probeAbi, functionName: "withdrawNative", args: [leftover] }),
    { to: probe, gas: 5_000_000n },
  );

  const evidence = {
    chainId: 50312,
    probe,
    deployTx: createRcpt.transactionHash,
    fundTx: fund.transactionHash,
    armTx: arm.transactionHash,
    cancelTx: cancel.transactionHash,
    withdrawTx: withdraw.transactionHash,
    subscriptionId: subId.toString(),
    armedBlock: armedBlock.toString(),
    probeStake: probeBal.toString(),
    hits: hits.toString(),
    lastMsgSender,
    lastEmitter,
    lastTopic0,
    lastBlock: lastBlock.toString(),
    precompile: REACTIVITY_PRECOMPILE,
    callbackVerified,
    nativeBefore: formatEther(nativeBefore),
    note: callbackVerified
      ? "isolated BlockTick callback VERIFIED; msg.sender==0x0100"
      : "no callback within poll window — not automatically a protocol bug",
  };
  writeEvidence("shannon-reactivity-probe.json", evidence);
  return evidence;
}
