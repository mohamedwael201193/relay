import { parseAbi, type Address, type Hex } from "viem";
import type { LocalAccount } from "viem/accounts";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { getMarketOnchainHttp } from "./onchain.js";
import { sendHttp, shannonHttpClient } from "./sendHttp.js";
import { erc20Balance } from "./rpc.js";
import { voidExpiredIsCallable } from "./settleGate.js";
import { loadShannonDeployment, writeEvidence } from "./vaultOps.js";

const MODULE = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
const COLLATERAL = requiredAddress(SHANNON_ADDRESSES.collateral, "collateral");

const vaultAbi = parseAbi([
  "function syncResolution(bytes32 marketId)",
  "function redeemPosition(bytes32 marketId, uint8 outcomeIdx, uint256 amount)",
  "function approveOutcomeOperator(address token, bool approved)",
]);

const moduleAbi = parseAbi([
  "function pokeOracle(uint256 oracleQuestionId)",
  "function syncSettlement(bytes32 marketId)",
]);

const token6909Abi = parseAbi([
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function isOperator(address owner, address spender) view returns (bool)",
]);

const marketAbi = parseAbi([
  "function outcomeToken() view returns (address)",
  "function voidExpired()",
]);

type SettleTx = { name: string; hash: string; status: string };

async function trySend(
  account: LocalAccount,
  name: string,
  data: Hex,
  to: Address,
  gas: bigint,
  txs: SettleTx[],
): Promise<void> {
  try {
    const rcpt = await sendHttp(account, data, { to, gas });
    txs.push({ name, hash: rcpt.transactionHash, status: rcpt.status });
  } catch (e) {
    txs.push({ name, hash: "threw", status: (e as Error).message });
  }
}

export async function settleFilledMarket(
  account: LocalAccount,
  marketId: Hex,
  opts: { vault?: Address } = {},
) {
  const dep = loadShannonDeployment();
  const vault = opts.vault ?? dep.vault;
  const client = shannonHttpClient();
  const before = await getMarketOnchainHttp(client, MODULE, marketId);
  const { encodeFunctionData } = await import("viem");
  const txs: SettleTx[] = [];

  if (!before.isResolved && !before.isVoided) {
    await trySend(
      account,
      "pokeOracle",
      encodeFunctionData({
        abi: moduleAbi,
        functionName: "pokeOracle",
        args: [before.oracleQuestionId],
      }),
      MODULE,
      10_000_000n,
      txs,
    );
    await trySend(
      account,
      "syncSettlement",
      encodeFunctionData({
        abi: moduleAbi,
        functionName: "syncSettlement",
        args: [marketId],
      }),
      MODULE,
      10_000_000n,
      txs,
    );
  }

  let mid = await getMarketOnchainHttp(client, MODULE, marketId);
  if (!mid.isResolved && !mid.isVoided) {
    const head = await client.getBlock();
    if (voidExpiredIsCallable(mid.expiry, mid.settlementWindow, head.timestamp)) {
      await trySend(
        account,
        "voidExpired",
        encodeFunctionData({ abi: marketAbi, functionName: "voidExpired" }),
        mid.market,
        10_000_000n,
        txs,
      );
      await trySend(
        account,
        "syncSettlement",
        encodeFunctionData({
          abi: moduleAbi,
          functionName: "syncSettlement",
          args: [marketId],
        }),
        MODULE,
        10_000_000n,
        txs,
      );
      mid = await getMarketOnchainHttp(client, MODULE, marketId);
    }
  }

  const afterPoke = mid;
  const outcomeToken = (await client.readContract({
    address: afterPoke.market,
    abi: marketAbi,
    functionName: "outcomeToken",
  })) as Address;
  let moduleApprovedStart = false;
  try {
    moduleApprovedStart = await client.readContract({
      address: outcomeToken,
      abi: token6909Abi,
      functionName: "isOperator",
      args: [vault, MODULE],
    });
  } catch {
    moduleApprovedStart = false;
  }
  const [yesBal, noBal] = await Promise.all([
    client.readContract({
      address: outcomeToken,
      abi: token6909Abi,
      functionName: "balanceOf",
      args: [vault, afterPoke.yesId],
    }),
    client.readContract({
      address: outcomeToken,
      abi: token6909Abi,
      functionName: "balanceOf",
      args: [vault, afterPoke.noId],
    }),
  ]);

  let redeemTx: Hex | null = null;
  let syncVaultTx: Hex | null = null;
  let redeemed = false;
  let needsOutcomeApproval = false;
  const vaultColBefore = await erc20Balance(client, COLLATERAL, vault);

  const base = {
    chainId: 50312,
    marketId,
    vault,
    statusBefore: before.statusLabel,
    statusAfter: afterPoke.statusLabel,
    resolved: afterPoke.isResolved,
    voided: afterPoke.isVoided,
    voidPolicy: afterPoke.voidPolicy,
    payoutNumerators: afterPoke.payoutNumerators.map(String),
    yesBal: yesBal.toString(),
    noBal: noBal.toString(),
    vaultCollateralBefore: vaultColBefore.toString(),
    pokeAndSyncTxs: txs,
  };

  if (afterPoke.isResolved || afterPoke.isVoided) {
    const sv = await sendHttp(
      account,
      encodeFunctionData({ abi: vaultAbi, functionName: "syncResolution", args: [marketId] }),
      { to: vault, gas: 10_000_000n },
    );
    syncVaultTx = sv.transactionHash;
    txs.push({ name: "syncResolution", hash: sv.transactionHash, status: sv.status });

    let moduleApproved = moduleApprovedStart;
    if (!moduleApproved) {
      await trySend(
        account,
        "approveOutcomeOperator",
        encodeFunctionData({
          abi: vaultAbi,
          functionName: "approveOutcomeOperator",
          args: [outcomeToken, true],
        }),
        vault,
        5_000_000n,
        txs,
      );
      moduleApproved = await client.readContract({
        address: outcomeToken,
        abi: token6909Abi,
        functionName: "isOperator",
        args: [vault, MODULE],
      }).catch(() => false);
    }

    const nums = afterPoke.payoutNumerators;
    let win = 0;
    for (let i = 1; i < nums.length; i++) {
      if ((nums[i] ?? 0n) > (nums[win] ?? 0n)) win = i;
    }
    const amount = afterPoke.isVoided ? (win === 0 ? yesBal : noBal) : win === 0 ? yesBal : noBal;
    const voidYes = afterPoke.isVoided ? yesBal : 0n;
    const voidNo = afterPoke.isVoided ? noBal : 0n;
    const mustRedeem = afterPoke.isVoided ? voidYes > 0n || voidNo > 0n : amount > 0n;

    if (mustRedeem && !moduleApproved) {
      needsOutcomeApproval = true;
      const vaultColAfter = await erc20Balance(client, COLLATERAL, vault);
      const evidence = {
        ...base,
        vaultCollateralAfter: vaultColAfter.toString(),
        syncVaultTx,
        redeemTx,
        redeemed: false,
        needsOutcomeApproval: true,
        outcome: "unresolved" as const,
        settled: false,
        winningOutcome: win,
      };
      writeEvidence("shannon-settlement.json", evidence);
      return evidence;
    }

    async function redeemSide(idx: number, amt: bigint) {
      if (amt === 0n) return;
      const rcpt = await sendHttp(
        account,
        encodeFunctionData({
          abi: vaultAbi,
          functionName: "redeemPosition",
          args: [marketId, idx, amt],
        }),
        { to: vault, gas: 15_000_000n },
      );
      redeemTx = rcpt.transactionHash;
      redeemed = rcpt.status === "success";
      txs.push({ name: "redeemPosition", hash: rcpt.transactionHash, status: rcpt.status });
    }

    let outcome: "win" | "loss" | "void" | "unresolved" = "unresolved";
    if (afterPoke.isVoided) {
      await redeemSide(0, voidYes);
      await redeemSide(1, voidNo);
      outcome = "void";
    } else {
      await redeemSide(win, amount);
      outcome = amount === 0n ? "loss" : redeemed ? "win" : "win";
    }
    const settled = afterPoke.isVoided
      ? redeemed || (voidYes === 0n && voidNo === 0n)
      : amount === 0n || redeemed;
    if (amount === 0n && !afterPoke.isVoided) redeemed = false;
    if (mustRedeem && !redeemed) needsOutcomeApproval = !moduleApproved;

    const vaultColAfter = await erc20Balance(client, COLLATERAL, vault);
    const evidence = {
      ...base,
      vaultCollateralAfter: vaultColAfter.toString(),
      syncVaultTx,
      redeemTx,
      redeemed,
      needsOutcomeApproval,
      outcome,
      settled,
      winningOutcome: win,
    };
    writeEvidence("shannon-settlement.json", evidence);
    return evidence;
  }

  const vaultColAfter = await erc20Balance(client, COLLATERAL, vault);
  const evidence = {
    ...base,
    vaultCollateralAfter: vaultColAfter.toString(),
    syncVaultTx,
    redeemTx,
    redeemed: false,
    needsOutcomeApproval: false,
    outcome: "unresolved" as const,
    settled: false,
    winningOutcome: null as number | null,
  };
  writeEvidence("shannon-settlement.json", evidence);
  return evidence;
}

export async function settleFilledMarketFromKey(
  privateKey: Hex,
  marketId: Hex,
  vault?: Address,
) {
  const { privateKeyToAccount } = await import("viem/accounts");
  return settleFilledMarket(privateKeyToAccount(privateKey), marketId, { vault });
}
