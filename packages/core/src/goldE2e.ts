import { encodeFunctionData, parseAbi, parseAbiItem, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { getMarketOnchainHttp } from "./onchain.js";
import { runLiveOrder } from "./execute.js";
import { settleFilledMarket } from "./settle.js";
import { loadShannonDeployment, writeEvidence } from "./vaultOps.js";
import { sendHttp, shannonHttpClient } from "./sendHttp.js";
import { nowNs } from "./discover.js";
import { assertShannonExecution } from "./gates.js";

const managerAbi = parseAbi([
  "function register(address vault, bytes32 marketId) returns (uint256)",
  "function subscriptionOf(bytes32) view returns (uint256)",
]);

const lapSettledEvent = parseAbiItem(
  "event LapSettled(bytes32 indexed marketId, uint256 questionId, bool voided, uint8 winningOutcome, bool fromCallback)",
);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runGoldE2e(privateKey: Hex) {
  assertShannonExecution();
  const account = privateKeyToAccount(privateKey);
  const client = shannonHttpClient();
  const dep = loadShannonDeployment();
  const module = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
  const fromBlock = await client.getBlockNumber();

  const stake = parseEther("33");
  const managerBal = await client.getBalance({ address: dep.manager });
  const fundTxs: string[] = [];
  if (managerBal < stake) {
    const need = stake - managerBal;
    const fund = await sendHttp(account, "0x", { to: dep.manager, gas: 5_000_000n, value: need });
    fundTxs.push(fund.transactionHash);
    if (fund.status !== "success") throw new Error(`manager fund failed hash=${fund.transactionHash}`);
  }

  const lap1 = await runLiveOrder(account, {
    intervalSec: "60",
    iocOnly: true,
    evidenceName: "shannon-gold-lap1.json",
    waitMs: 120_000,
  });
  const filled1 = lap1.ioc ?? lap1.postOnly;
  const market1 = filled1?.marketId;
  if (!market1) throw new Error("lap1 placed no market");
  if (filled1.fillClass !== "FILL" && filled1.fillClass !== "PARTIAL_FILL") {
    throw new Error(`lap1 was not a directional fill fillClass=${filled1.fillClass} tx=${filled1.placeTx}`);
  }

  let registerTx: string | null = null;
  let subscriptionId: string | null = null;
  try {
    const { keccak256, encodePacked } = await import("viem");
    const k = keccak256(encodePacked(["address", "bytes32"], [dep.vault, market1]));
    const reg = await sendHttp(
      account,
      encodeFunctionData({
        abi: managerAbi,
        functionName: "register",
        args: [dep.vault, market1],
      }),
      { to: dep.manager, gas: 10_000_000n },
    );
    registerTx = reg.transactionHash;
    if (reg.status === "success") {
      const id = await client.readContract({
        address: dep.manager,
        abi: managerAbi,
        functionName: "subscriptionOf",
        args: [k],
      });
      subscriptionId = id.toString();
    } else {
      const id = await client.readContract({
        address: dep.manager,
        abi: managerAbi,
        functionName: "subscriptionOf",
        args: [k],
      });
      if (id !== 0n) subscriptionId = id.toString();
    }
  } catch (e) {
    registerTx = `threw:${(e as Error).message}`;
  }

  const expireNs = BigInt(filled1.expireNs);
  const waitUntilMs = Number(expireNs / 1_000_000n) + 20_000;
  const cap = Date.now() + 420_000;
  while (Date.now() < waitUntilMs && Date.now() < cap) {
    await sleep(Math.min(3000, waitUntilMs - Date.now()));
  }

  let status = "Trading";
  let resolvedVia = "timeout";
  for (let i = 0; i < 90; i++) {
    const onchain = await getMarketOnchainHttp(client, module, market1);
    status = onchain.statusLabel;
    if (onchain.isResolved || onchain.isVoided || onchain.statusLabel === "Resolved" || onchain.statusLabel === "Voided") {
      resolvedVia = "rpc";
      break;
    }
    await sleep(2000);
  }

  const settlement = await settleFilledMarket(account, market1);

  let fromCallback = false;
  try {
    const logs = await client.getLogs({
      address: dep.vault,
      event: lapSettledEvent,
      args: { marketId: market1 },
      fromBlock,
    });
    fromCallback = logs.some((l) => Boolean(l.args.fromCallback));
  } catch {
    fromCallback = false;
  }

  const lap2Attempts: Array<Record<string, unknown>> = [];
  const skip = [market1];
  let lap2 = await runLiveOrder(account, {
    intervalSec: lap1.intervalSec ?? "60",
    iocOnly: true,
    evidenceName: "shannon-gold-lap2.json",
    skipMarketIds: skip,
    waitMs: 90_000,
  });
  let filled2 = lap2.ioc ?? lap2.postOnly;
  lap2Attempts.push({
    marketId: filled2?.marketId ?? null,
    fillClass: filled2?.fillClass ?? null,
    placeTx: filled2?.placeTx ?? null,
    vaultReason: filled2?.vaultReason ?? null,
  });
  for (let i = 0; i < 4; i++) {
    const ok =
      filled2 &&
      (filled2.fillClass === "FILL" || filled2.fillClass === "PARTIAL_FILL");
    if (ok) break;
    if (filled2?.marketId) skip.push(filled2.marketId);
    lap2 = await runLiveOrder(account, {
      intervalSec: lap1.intervalSec ?? "60",
      iocOnly: true,
      evidenceName: "shannon-gold-lap2.json",
      skipMarketIds: skip,
      waitMs: 90_000,
    });
    filled2 = lap2.ioc ?? lap2.postOnly;
    lap2Attempts.push({
      marketId: filled2?.marketId ?? null,
      fillClass: filled2?.fillClass ?? null,
      placeTx: filled2?.placeTx ?? null,
      vaultReason: filled2?.vaultReason ?? null,
    });
  }

  const evidence = {
    chainId: 50312,
    vault: dep.vault,
    manager: dep.manager,
    managerFundTxs: fundTxs,
    registerTx,
    subscriptionId,
    nowNsAtFinish: nowNs().toString(),
    lap1: {
      asset: lap1.asset,
      intervalSec: lap1.intervalSec,
      marketId: market1,
      fillClass: filled1.fillClass,
      placeTx: filled1.placeTx,
      filled: filled1.filled,
      expireNs: filled1.expireNs,
    },
    wait: { status, resolvedVia, fromCallback },
    settlement: {
      statusAfter: settlement.statusAfter,
      redeemed: settlement.redeemed,
      redeemTx: settlement.redeemTx,
      vaultCollateralAfter: settlement.vaultCollateralAfter,
      resolved: settlement.resolved,
      voided: settlement.voided,
      settled: settlement.settled,
      outcome: settlement.outcome,
    },
    lap2: {
      asset: lap2.asset,
      intervalSec: lap2.intervalSec,
      marketId: filled2?.marketId ?? null,
      fillClass: filled2?.fillClass ?? null,
      placeTx: filled2?.placeTx ?? null,
      filled: filled2?.filled ?? null,
      placedEvent: filled2?.placedEvent ?? null,
      attempts: lap2Attempts,
    },
    autonomous:
      (filled1.fillClass === "FILL" || filled1.fillClass === "PARTIAL_FILL") &&
      settlement.settled &&
      Boolean(
        filled2 &&
          (filled2.fillClass === "FILL" || filled2.fillClass === "PARTIAL_FILL"),
      ),
    note: "lap2 is placed by this off-chain worker after settlement/redeem; strategy is not inside the Reactivity callback",
  };
  writeEvidence("shannon-gold-e2e.json", evidence);
  return evidence;
}
