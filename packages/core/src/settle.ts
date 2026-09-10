import { parseAbi, type Address, type Hex } from "viem";
import type { LocalAccount } from "viem/accounts";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { getMarketOnchainHttp } from "./onchain.js";
import { sendHttp, shannonHttpClient } from "./sendHttp.js";
import { erc20Balance } from "./rpc.js";
import { loadShannonDeployment, writeEvidence } from "./vaultOps.js";

const MODULE = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
const COLLATERAL = requiredAddress(SHANNON_ADDRESSES.collateral, "collateral");
const ORACLE = requiredAddress(SHANNON_ADDRESSES.oracleHub, "oracleHub");

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

const marketAbi = parseAbi(["function outcomeToken() view returns (address)"]);

export async function settleFilledMarket(account: LocalAccount, marketId: Hex) {
  const dep = loadShannonDeployment();
  const client = shannonHttpClient();
  const before = await getMarketOnchainHttp(client, MODULE, marketId);
  const { encodeFunctionData } = await import("viem");
  const txs: { name: string; hash: string; status: string }[] = [];

  if (before.statusLabel === "Trading" || before.statusLabel === "Locked" || before.statusLabel === "Settling") {
    try {
      const poke = await sendHttp(
        account,
        encodeFunctionData({
          abi: moduleAbi,
          functionName: "pokeOracle",
          args: [before.oracleQuestionId],
        }),
        { to: MODULE, gas: 10_000_000n },
      );
      txs.push({ name: "pokeOracle", hash: poke.transactionHash, status: poke.status });
    } catch (e) {
      txs.push({ name: "pokeOracle", hash: "threw", status: (e as Error).message });
    }
    try {
      const sync = await sendHttp(
        account,
        encodeFunctionData({
          abi: moduleAbi,
          functionName: "syncSettlement",
          args: [marketId],
        }),
        { to: MODULE, gas: 10_000_000n },
      );
      txs.push({ name: "syncSettlement", hash: sync.transactionHash, status: sync.status });
    } catch (e) {
      txs.push({ name: "syncSettlement", hash: "threw", status: (e as Error).message });
    }
  }

  const afterPoke = await getMarketOnchainHttp(client, MODULE, marketId);
  const outcomeToken = (await client.readContract({
    address: afterPoke.market,
    abi: marketAbi,
    functionName: "outcomeToken",
  })) as Address;
  const yesBal = await client.readContract({
    address: outcomeToken,
    abi: token6909Abi,
    functionName: "balanceOf",
    args: [dep.vault, afterPoke.yesId],
  });
  const noBal = await client.readContract({
    address: outcomeToken,
    abi: token6909Abi,
    functionName: "balanceOf",
    args: [dep.vault, afterPoke.noId],
  });

  let redeemTx: Hex | null = null;
  let syncVaultTx: Hex | null = null;
  let redeemed = false;
  const vaultColBefore = await erc20Balance(client, COLLATERAL, dep.vault);

  if (afterPoke.isResolved || afterPoke.isVoided) {
    const sv = await sendHttp(
      account,
      encodeFunctionData({ abi: vaultAbi, functionName: "syncResolution", args: [marketId] }),
      { to: dep.vault, gas: 10_000_000n },
    );
    syncVaultTx = sv.transactionHash;
    const appr = await sendHttp(
      account,
      encodeFunctionData({
        abi: vaultAbi,
        functionName: "approveOutcomeOperator",
        args: [outcomeToken, true],
      }),
      { to: dep.vault, gas: 5_000_000n },
    );
    txs.push({ name: "approveOutcomeOperator", hash: appr.transactionHash, status: appr.status });

    const nums = afterPoke.payoutNumerators;
    let win = 0;
    for (let i = 1; i < nums.length; i++) {
      if ((nums[i] ?? 0n) > (nums[win] ?? 0n)) win = i;
    }
    const amount = afterPoke.isVoided ? (win === 0 ? yesBal : noBal) : win === 0 ? yesBal : noBal;
    const voidYes = afterPoke.isVoided ? yesBal : 0n;
    const voidNo = afterPoke.isVoided ? noBal : 0n;

    async function redeemSide(idx: number, amt: bigint) {
      if (amt === 0n) return;
      const rcpt = await sendHttp(
        account,
        encodeFunctionData({
          abi: vaultAbi,
          functionName: "redeemPosition",
          args: [marketId, idx, amt],
        }),
        { to: dep.vault, gas: 15_000_000n },
      );
      redeemTx = rcpt.transactionHash;
      redeemed = rcpt.status === "success";
    }

    if (afterPoke.isVoided) {
      await redeemSide(0, voidYes);
      await redeemSide(1, voidNo);
    } else {
      await redeemSide(win, amount);
    }
  }

  const vaultColAfter = await erc20Balance(client, COLLATERAL, dep.vault);
  const evidence = {
    chainId: 50312,
    marketId,
    vault: dep.vault,
    statusBefore: before.statusLabel,
    statusAfter: afterPoke.statusLabel,
    resolved: afterPoke.isResolved,
    voided: afterPoke.isVoided,
    voidPolicy: afterPoke.voidPolicy,
    payoutNumerators: afterPoke.payoutNumerators.map(String),
    yesBal: yesBal.toString(),
    noBal: noBal.toString(),
    vaultCollateralBefore: vaultColBefore.toString(),
    vaultCollateralAfter: vaultColAfter.toString(),
    pokeAndSyncTxs: txs,
    syncVaultTx,
    redeemTx,
    redeemed,
  };
  writeEvidence("shannon-settlement.json", evidence);
  return evidence;
}

export async function settleFilledMarketFromKey(privateKey: Hex, marketId: Hex) {
  const { privateKeyToAccount } = await import("viem/accounts");
  return settleFilledMarket(privateKeyToAccount(privateKey), marketId);
}
