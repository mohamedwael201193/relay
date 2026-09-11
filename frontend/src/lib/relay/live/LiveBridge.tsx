"use client";

import { useEffect, useRef } from "react";
import { useActiveWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { eventsUrl, relayApi, type NetworkConfig, type ProofBundle } from "@/lib/relay/api/client";
import { publicNetwork } from "@/lib/relay/api/normalizeNetwork";
import { isOpsVault, SHANNON_CHAIN_ID } from "@/lib/relay/config/network";
import { useRelay } from "@/lib/relay/engine/store";
import { isLiveMode } from "@/lib/relay/live/mode";
import { somniaShannon } from "@/lib/relay/live/chain";
import { ownerMessage, vaultWriteAbi } from "@/lib/relay/live/abi";
import { registerLiveHandlers } from "@/lib/relay/live/registry";
import { ownerFromPrivy, pickConnectedWallet } from "@/lib/relay/live/ownerAddress";
import { pickOwnedVault, selectDeployVault } from "@/lib/relay/live/pickOwnedVault";
import { ownerBoundReset } from "@/lib/relay/live/ownerSession";
import {
  arenaFromRows,
  calendarFromMarkets,
  impliedStartBankroll,
  lapsFromHistory,
  liveFeedHistory,
  liveLapFromState,
  bookSnapshotFromLive,
  notificationsFromBoosts,
  notificationsFromLaps,
  notificationsFromLifecycle,
  relationshipsFromArenaBoosts,
  runnerFromRow,
  streakFromHistory,
} from "@/lib/relay/live/apply";
import { resultFromLap } from "@/lib/relay/analytics";

type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type ConnectedWallet = {
  address: string;
  chainId?: string | number;
  walletClientType?: string;
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<EthereumProvider>;
};

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "");
  const hex = s.match(/0x[0-9a-f]+/i)?.[0];
  if (hex) return Number.parseInt(hex, 16);
  const dec = s.match(/(\d{4,})/)?.[1];
  return dec ? Number(dec) : null;
}

async function assertShannonChain(provider: EthereumProvider, wallet?: ConnectedWallet) {
  const read = async () => parseChainId(await provider.request({ method: "eth_chainId" }));
  if ((await read()) === SHANNON_CHAIN_ID) return;
  await wallet?.switchChain(SHANNON_CHAIN_ID).catch(() => undefined);
  if ((await read()) !== SHANNON_CHAIN_ID) {
    throw new Error("Wrong network — switch to Somnia Shannon (chain 50312)");
  }
}

function phase(label: string, status: "waiting" | "signing" | "submitting" | "confirming" | "confirmed" | "failed", hash?: string) {
  useRelay.setState({ txPhase: { label, status, hash } });
}

function reportApiError(message: string) {
  useRelay.setState((s) => {
    if (s.apiError === message) return s;
    return {
      apiError: message,
      notifications: [
        {
          id: `api-${Date.now()}`,
          kind: "INFO" as const,
          title: "RELAY API",
          body: message,
          at: Date.now(),
          read: false,
        },
        ...s.notifications,
      ].slice(0, 40),
    };
  });
}

async function publicFor(net: NetworkConfig) {
  return createPublicClient({
    chain: somniaShannon,
    transport: http(net.rpcUrl, { timeout: 20_000 }),
  });
}

async function readWalletBalances(net: NetworkConfig, owner: string) {
  const publicClient = await publicFor(net);
  const [stt, tusdc] = await Promise.all([
    publicClient.getBalance({ address: owner as Address }),
    publicClient.readContract({
      address: net.collateral as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as Address],
    }),
  ]);
  useRelay.setState((s) => ({
    wallet: {
      ...s.wallet,
      address: owner,
      connected: true,
      chainId: SHANNON_CHAIN_ID,
      network: "Somnia · Shannon testnet",
      nativeSTT: Number(formatEther(stt)),
      tUSDC: Number(formatUnits(tusdc, net.decimals)),
    },
  }));
}

async function refreshRunner(net: NetworkConfig, owner: string, vaultHint?: string | null) {
  const listed = await relayApi.runnersByOwner(owner);
  const vault = pickOwnedVault(listed.runners, vaultHint);
  if (!vault) {
    const arena = await relayApi.arena().catch(() => ({ runners: [] as never[], boosts: [] as never[] }));
    const mappedArena = arenaFromRows(arena.runners ?? [], null);
    useRelay.setState({
      ...ownerBoundReset(),
      arena: mappedArena,
      boosts: relationshipsFromArenaBoosts("boosts" in arena ? arena.boosts ?? [] : [], mappedArena),
    });
    return;
  }
  const mine = listed.runners.find((r) => r.vault.toLowerCase() === vault) ?? listed.runners[0];
  const [live, history, proof, markets, arena] = await Promise.all([
    relayApi.live(vault).catch(() => mine ?? null),
    relayApi.history(vault).catch(() => ({ laps: [] as never[] })),
    relayApi.proof(vault).catch(() => ({ proof: { orders: [], settlements: [], records: [] } as ProofBundle })),
    relayApi.markets(mine.last_market_id).catch(() => ({ rows: [] })),
    relayApi.arena().catch(() => ({ runners: [] })),
  ]);
  let row =
    live && "vault" in live && "lastMarketId" in live
      ? { ...mine, ...live, vault: live.vault, state: live.state, last_market_id: live.lastMarketId, last_error: live.lastError, lap_index: live.lapIndex }
      : mine;
  if (!row) return;
  const cfg = { ...useRelay.getState().draftConfig };
  const now = Date.now();
  const proofBundle = proof && "proof" in proof ? proof.proof : { orders: [], settlements: [], records: [] };
  const marketsRows = markets && "rows" in markets ? markets.rows : [];
  const historyLaps = history && "laps" in history ? history.laps : [];
  let vaultBal = 0;
  let onchainKilled = false;
  let shieldCharges = 0;
  let shieldsMaxOnchain = 0;
  try {
    const pc = await publicFor(net);
    const [bal, killed, charges, maxSh, budgetRaw, stopRaw] = await Promise.all([
      pc.readContract({
        address: net.collateral as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vault as Address],
      }),
      pc.readContract({
        address: vault as Address,
        abi: vaultWriteAbi,
        functionName: "killed",
      }),
      pc.readContract({
        address: vault as Address,
        abi: vaultWriteAbi,
        functionName: "shieldCharges",
      }).catch(() => 0),
      pc.readContract({
        address: vault as Address,
        abi: vaultWriteAbi,
        functionName: "shieldsMax",
      }).catch(() => 0),
      pc.readContract({
        address: vault as Address,
        abi: vaultWriteAbi,
        functionName: "budget",
      }).catch(() => 0n),
      pc.readContract({
        address: vault as Address,
        abi: vaultWriteAbi,
        functionName: "maxDailyLoss",
      }).catch(() => 0n),
    ]);
    vaultBal = Number(formatUnits(bal, net.decimals));
    onchainKilled = Boolean(killed);
    shieldCharges = Number(charges) || 0;
    shieldsMaxOnchain = Number(maxSh) || 0;
    const chainBudget = Number(formatUnits(budgetRaw as bigint, net.decimals));
    const chainStop = Number(formatUnits(stopRaw as bigint, net.decimals));
    if (chainBudget > 0) cfg.budget = chainBudget;
    if (chainStop > 0) cfg.stopLoss = chainStop;
  } catch {
    vaultBal = useRelay.getState().bankroll;
  }
  if (onchainKilled) row = { ...row, state: "KILLED" };
  const streak = streakFromHistory(historyLaps);
  const protectedCount = historyLaps.filter(
    (l) => l.shielded && (l.state === "SETTLED_LOSS"),
  ).length;
  const mappedLaps = lapsFromHistory(historyLaps, proofBundle, marketsRows);
  const lastSettled = [...mappedLaps].reverse().find((l) => l.outcome !== "OPEN");
  const builtResult = lastSettled ? resultFromLap(lastSettled, vaultBal) : null;
  const prev = useRelay.getState();
  const isNewResult = Boolean(
    builtResult &&
      prev.laps.some((l) => l.number === builtResult.lap && l.outcome === "OPEN"),
  );
  const lapNotes = notificationsFromLaps(prev.laps, mappedLaps);
  const mappedArena = arenaFromRows(arena.runners ?? [], vault);
  const mappedBoosts = relationshipsFromArenaBoosts("boosts" in arena ? arena.boosts ?? [] : [], mappedArena);
  const boostNotes = notificationsFromBoosts(prev.boosts, mappedBoosts, vault);
  const lifeNotes = notificationsFromLifecycle({
    prevError: prev.backendLastError,
    nextError: row.last_error ?? null,
    prevState: prev.backendState,
    nextState: row.state,
    lapIndex: row.lap_index,
  });
  const incomingNotes = [...boostNotes, ...lapNotes, ...lifeNotes];
  const lastId = (row.last_market_id ?? "").toLowerCase();
  const liveLap = liveLapFromState({
    row,
    markets: marketsRows,
    proof: proofBundle,
    now,
    history: historyLaps,
    prev: prev.liveLap,
  });
  const activeMarketId = (liveLap?.market.marketId ?? lastId).toLowerCase();
  const histRow = marketsRows.find((m) => m.marketId.toLowerCase() === activeMarketId);
  const priceHistory = (
    histRow?.priceHistory?.filter((p) => Number.isFinite(p.p) && p.p > 0) ??
    (liveLap ? liveFeedHistory(marketsRows, liveLap.market.asset) : [])
  );
  const book = bookSnapshotFromLive(histRow?.book);
  useRelay.setState({
    vaultAddress: vault,
    backendState: row.state,
    backendLastError: row.last_error ?? null,
    apiError: null,
    runner: runnerFromRow(row, useRelay.getState().runner?.name ?? "Runner", cfg),
    config: cfg,
    liveLap,
    calendar: calendarFromMarkets(marketsRows, now),
    laps: mappedLaps,
    arena: mappedArena,
    boosts: mappedBoosts,
    bankroll: vaultBal,
    startBankroll: impliedStartBankroll(vaultBal, mappedLaps),
    peakBankroll: Math.max(useRelay.getState().peakBankroll, vaultBal),
    streak: {
      current: streak.current,
      best: Math.max(useRelay.getState().streak.best, streak.best),
      shields: shieldCharges,
      shieldsMax: shieldsMaxOnchain,
      nextShield: 0,
      protectedCount,
    },
    lastResult: builtResult,
    resultOpen: isNewResult ? true : prev.resultOpen,
    resultSeen: isNewResult ? false : prev.resultSeen,
    notifications: incomingNotes.length
      ? [...incomingNotes, ...prev.notifications.filter((n) => !incomingNotes.some((x) => x.id === n.id))].slice(0, 40)
      : prev.notifications,
    now,
    priceHistory,
    book,
  });
}

export function LiveBridge() {
  const { ready, authenticated, login, user, createWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const owner = ownerFromPrivy({
    wallets: activeWallet?.address ? [activeWallet, ...wallets] : wallets,
    user,
  });
  const mergedWallets = (
    activeWallet?.address
      ? [
          activeWallet as ConnectedWallet,
          ...wallets.filter((w) => w.address.toLowerCase() !== activeWallet.address.toLowerCase()),
        ]
      : wallets
  ) as ConnectedWallet[];
  const ctx = useRef({ wallets: mergedWallets, authenticated, login, user, createWallet, owner });
  ctx.current = { wallets: mergedWallets, authenticated, login, user, createWallet, owner };
  const triedCreate = useRef(false);

  useEffect(() => {
    if (!isLiveMode()) return undefined;

    async function clients(net: NetworkConfig) {
      const wallet = pickConnectedWallet(ctx.current.wallets, ctx.current.owner);
      const injected = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (!wallet && !injected) throw new Error("Connect a wallet first");
      const embedded = wallet?.walletClientType === "privy";
      const wanted = (wallet?.address ?? ctx.current.owner)?.toLowerCase();
      const provider = embedded
        ? await wallet!.getEthereumProvider()
        : (injected ?? (await wallet!.getEthereumProvider()));
      await assertShannonChain(provider, wallet);
      let account: Address | undefined;
      if (embedded) {
        account = wallet!.address as Address;
      } else {
        let accounts = ((await provider.request({ method: "eth_accounts" })) as string[]) ?? [];
        if (wanted && !accounts.some((a) => a.toLowerCase() === wanted)) {
          accounts = ((await provider.request({ method: "eth_requestAccounts" })) as string[]) ?? [];
        }
        const match = wanted
          ? accounts.find((a) => a.toLowerCase() === wanted)
          : accounts[0];
        if (!match) throw new Error("Switch the connected wallet to the active address");
        account = getAddress(match);
      }
      const walletClient = createWalletClient({
        account,
        chain: somniaShannon,
        transport: custom(provider),
      });
      const publicClient = await publicFor(net);
      return { walletClient, publicClient, owner: account };
    }

    async function signAction(
      action: string,
      vault: string,
      owner: Address,
      walletClient: ReturnType<typeof createWalletClient>,
    ) {
      const timestamp = Date.now();
      phase("Waiting for wallet", "waiting");
      phase("Signing", "signing");
      const signature = await walletClient.signMessage({
        account: owner,
        message: ownerMessage(action, vault, timestamp),
      });
      return { timestamp, signature, owner };
    }

    async function send(
      walletClient: ReturnType<typeof createWalletClient>,
      publicClient: Awaited<ReturnType<typeof publicFor>>,
      tx: { to: Address; data: Hex },
    ) {
      phase("Checking network", "waiting");
      let gas: bigint;
      try {
        gas = await publicClient.estimateGas({
          account: walletClient.account!,
          to: tx.to,
          data: tx.data,
        });
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (/killed|0x/i.test(msg) && /Killed|killed/.test(msg)) {
          throw new Error("This runner is already killed. Start again to deploy a new vault.");
        }
        throw new Error(
          msg.includes("insufficient funds")
            ? "Not enough STT for gas on Somnia Shannon"
            : "This transaction would fail on-chain. No wallet popup was opened.",
        );
      }
      phase("Submitting", "submitting");
      const hash = await walletClient.sendTransaction({
        account: walletClient.account!,
        chain: somniaShannon,
        ...tx,
        gas: gas + gas / 5n,
      });
      phase("Confirming", "confirming", hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success") {
        phase("Failed", "failed", hash);
        throw new Error("transaction reverted");
      }
      phase("Confirmed", "confirmed", hash);
      return hash;
    }

    registerLiveHandlers({
      deploy: async () => {
        try {
          phase("Waiting for wallet", "waiting");
          if (!ctx.current.authenticated) {
            ctx.current.login();
            return;
          }
          let net: NetworkConfig;
          try {
            net = await relayApi.network();
          } catch (e) {
            reportApiError((e as Error).message);
            throw e;
          }
          if (net.mainnetTradingEnabled) throw new Error("mainnet trading is off");
          const { walletClient, publicClient, owner } = await clients(net);
          const cfg = useRelay.getState().draftConfig;
          const listed = await relayApi.runnersByOwner(owner);
          const killedOnChain: Record<string, boolean> = {};
          await Promise.all(
            listed.runners.map(async (r) => {
              try {
                killedOnChain[r.vault.toLowerCase()] = Boolean(
                  await publicClient.readContract({
                    address: r.vault as Address,
                    abi: vaultWriteAbi,
                    functionName: "killed",
                  }),
                );
              } catch {
                killedOnChain[r.vault.toLowerCase()] = true;
              }
            }),
          );
          const intent = useRelay.getState().boostIntent;
          let vault = intent ? null : selectDeployVault(listed.runners, killedOnChain);
          const unit = parseUnits(String(cfg.budget), net.decimals);
          const stop = parseUnits(String(cfg.stopLoss), net.decimals);
          if (!vault) {
            phase("Creating vault", "signing");
          const auth = await signAction("provision", "new", owner, walletClient);
          phase("Provisioning vault", "submitting");
          const created = await relayApi.provision({
              ...auth,
              budget: cfg.budget,
              stopLoss: cfg.stopLoss,
              bias: cfg.bias,
              cadence: cfg.cadence,
              assets: cfg.assets,
              boostOf: intent?.leaderVault,
            });
            vault = created.vault;
          }
          const vaultAddr = vault as Address;
          const [vaultBal, currentOperator, currentBudget, allowance] = await Promise.all([
            publicClient.readContract({
              address: net.collateral as Address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [vaultAddr],
            }),
            publicClient.readContract({
              address: vaultAddr,
              abi: vaultWriteAbi,
              functionName: "operator",
            }),
            publicClient.readContract({
              address: vaultAddr,
              abi: vaultWriteAbi,
              functionName: "budget",
            }),
            publicClient.readContract({
              address: net.collateral as Address,
              abi: erc20Abi,
              functionName: "allowance",
              args: [owner, vaultAddr],
            }),
          ]);
          const needsFund = vaultBal === 0n;
          if (needsFund) {
            if (net.operator && String(currentOperator).toLowerCase() !== net.operator.toLowerCase()) {
              await send(walletClient, publicClient, {
                to: vaultAddr,
                data: encodeFunctionData({ abi: vaultWriteAbi, functionName: "setOperatorNow", args: [net.operator as Address] }),
              });
            }
            if (currentBudget !== unit) {
              const daily = stop < unit ? stop : unit;
              await send(walletClient, publicClient, {
                to: vaultAddr,
                data: encodeFunctionData({
                  abi: vaultWriteAbi,
                  functionName: "setCaps",
                  args: [unit, unit, daily, unit],
                }),
              });
            }
            if (allowance < unit) {
              await send(walletClient, publicClient, {
                to: net.collateral as Address,
                data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [vaultAddr, unit] }),
              });
            }
            await send(walletClient, publicClient, {
              to: vaultAddr,
              data: encodeFunctionData({ abi: vaultWriteAbi, functionName: "deposit", args: [unit] }),
            });
          }
          if (cfg.shieldsMax > 0) {
            try {
              await send(walletClient, publicClient, {
                to: vaultAddr,
                data: encodeFunctionData({
                  abi: vaultWriteAbi,
                  functionName: "setShieldsMax",
                  args: [cfg.shieldsMax],
                }),
              });
            } catch {
              /* old vault bytecode has no shields */
            }
          }
          const authStart = await signAction("start", vault, owner, walletClient);
          phase("Starting runner", "confirming");
          await relayApi.start(vault, authStart);
          const stillIntent = useRelay.getState().boostIntent;
          useRelay.setState({ vaultAddress: vault, startBankroll: cfg.budget, boostIntent: stillIntent });
          await readWalletBalances(net, owner);
          await refreshRunner(net, owner, vault);
          phase("Confirmed", "confirmed");
          if (!stillIntent) useRelay.getState().go("app", "live");
        } catch (e) {
          phase("Failed", "failed");
          reportApiError((e as Error).message);
        }
      },
      pause: async () => {
        const net = await relayApi.network();
        const { walletClient, owner } = await clients(net);
        const listed = await relayApi.runnersByOwner(owner);
        const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
        if (!vault || isOpsVault(vault)) return;
        const auth = await signAction("pause", vault, owner, walletClient);
        await relayApi.pause(vault, auth);
        await refreshRunner(net, owner, vault);
      },
      resume: async () => {
        const net = await relayApi.network();
        const { walletClient, owner } = await clients(net);
        const listed = await relayApi.runnersByOwner(owner);
        const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
        if (!vault || isOpsVault(vault)) return;
        const auth = await signAction("resume", vault, owner, walletClient);
        await relayApi.resume(vault, auth);
        await refreshRunner(net, owner, vault);
      },
      kill: async () => {
        try {
          const net = await relayApi.network();
          const { walletClient, publicClient, owner } = await clients(net);
          const listed = await relayApi.runnersByOwner(owner);
          const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
          if (!vault) return;
          if (isOpsVault(vault)) {
            throw new Error("Refusing to kill the ops vault from this session");
          }
          await send(walletClient, publicClient, {
            to: vault as Address,
            data: encodeFunctionData({ abi: vaultWriteAbi, functionName: "kill" }),
          });
          try {
            const auth = await signAction("stop", vault, owner, walletClient);
            await relayApi.stop(vault, auth);
          } catch {
            /* on-chain kill is enough; worker reconciles KILLED */
          }
          await refreshRunner(net, owner, vault);
        } catch (e) {
          phase("Failed", "failed");
          reportApiError((e as Error).message);
        }
      },
      withdraw: async () => {
        try {
          const net = await relayApi.network();
          const { walletClient, publicClient, owner } = await clients(net);
          const listed = await relayApi.runnersByOwner(owner);
          const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
          if (!vault) return;
          if (isOpsVault(vault)) {
            throw new Error("Refusing to withdraw the ops vault from this session");
          }
          const bal = await publicClient.readContract({
            address: net.collateral as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [vault as Address],
          });
          if (bal === 0n) return;
          await send(walletClient, publicClient, {
            to: vault as Address,
            data: encodeFunctionData({ abi: vaultWriteAbi, functionName: "withdraw", args: [bal] }),
          });
          await readWalletBalances(net, owner);
          await refreshRunner(net, owner, vault);
        } catch (e) {
          phase("Failed", "failed");
          reportApiError((e as Error).message);
        }
      },
      chargeShields: async () => {
        phase("Checking shields bytecode", "waiting");
        useRelay.setState({ apiError: null });
        try {
          const net = await relayApi.network();
          const rawOwner = ctx.current.owner || useRelay.getState().wallet.address;
          if (!rawOwner) throw new Error("Connect a wallet first");
          const owner = getAddress(rawOwner);
          const listed = await relayApi.runnersByOwner(owner);
          const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
          if (!vault || isOpsVault(vault)) {
            throw new Error("No owned vault to charge. Deploy a runner first.");
          }
          const n = Math.max(0, Math.min(3, useRelay.getState().draftConfig.shieldsMax));
          if (n <= 0) {
            throw new Error("Pick 1–3 shields in the draft, then charge.");
          }
          const publicClient = await publicFor(net);
          try {
            await publicClient.simulateContract({
              address: vault as Address,
              abi: vaultWriteAbi,
              functionName: "setShieldsMax",
              args: [n],
              account: owner,
            });
          } catch {
            throw new Error(
              "This vault cannot charge shields on-chain. Kill it and deploy a new runner — CHARGE SHIELDS needs the newer bytecode.",
            );
          }
          const { walletClient, publicClient: signedPublic, owner: signer } = await clients(net);
          await send(walletClient, signedPublic, {
            to: vault as Address,
            data: encodeFunctionData({
              abi: vaultWriteAbi,
              functionName: "setShieldsMax",
              args: [n],
            }),
          });
          await refreshRunner(net, signer, vault);
        } catch (e) {
          phase("Failed", "failed");
          reportApiError((e as Error).message);
        }
      },
      authorizeRedeem: async () => {
        try {
          const net = await relayApi.network();
          const { walletClient, publicClient, owner } = await clients(net);
          const listed = await relayApi.runnersByOwner(owner);
          const vault = pickOwnedVault(listed.runners, useRelay.getState().vaultAddress);
          if (!vault || isOpsVault(vault)) return;
          const live = await relayApi.live(vault).catch(() => null);
          const marketId = (live && "lastMarketId" in live ? live.lastMarketId : null) as Hex | null;
          if (!marketId) {
            reportApiError("no market to authorize");
            return;
          }
          const rec = await publicClient.readContract({
            address: net.module as Address,
            abi: parseAbi([
              "function markets(bytes32 marketId) view returns (uint256,uint8,uint8,address,uint32,bytes32,address,address,address,address,uint256,uint256,uint64,uint64)",
            ]),
            functionName: "markets",
            args: [marketId],
          });
          const marketAddr = rec[8] as Address;
          const outcomeToken = (await publicClient.readContract({
            address: marketAddr,
            abi: parseAbi(["function outcomeToken() view returns (address)"]),
            functionName: "outcomeToken",
          })) as Address;
          await send(walletClient, publicClient, {
            to: vault as Address,
            data: encodeFunctionData({
              abi: vaultWriteAbi,
              functionName: "approveOutcomeOperator",
              args: [outcomeToken, true],
            }),
          });
          await refreshRunner(net, owner, vault);
        } catch (e) {
          phase("Failed", "failed");
          reportApiError((e as Error).message);
        }
      },
    });
    return () => registerLiveHandlers(null);
  }, []);

  useEffect(() => {
    if (!isLiveMode()) return undefined;
    let cancelled = false;
    async function loadPublic() {
      try {
        const [arena, net] = await Promise.all([relayApi.arena(), relayApi.network().catch(() => publicNetwork())]);
        if (cancelled) return;
        const myVault = useRelay.getState().vaultAddress;
        const mappedArena = arenaFromRows(arena.runners ?? [], myVault);
        const mappedBoosts = relationshipsFromArenaBoosts("boosts" in arena ? arena.boosts ?? [] : [], mappedArena);
        const boostNotes = notificationsFromBoosts(useRelay.getState().boosts, mappedBoosts, myVault);
        useRelay.setState((s) => ({
          arena: mappedArena,
          boosts: mappedBoosts,
          apiError: null,
          notifications: boostNotes.length
            ? [...boostNotes, ...s.notifications.filter((n) => !boostNotes.some((x) => x.id === n.id))].slice(0, 40)
            : s.notifications,
        }));
        void net;
      } catch (e) {
        if (!cancelled) {
          reportApiError((e as Error).message);
          useRelay.setState({ arena: [], boosts: [] });
        }
      }
    }
    void loadPublic();
    const t = window.setInterval(() => void loadPublic(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!isLiveMode() || !ready || !authenticated || !walletsReady) return undefined;
    if (!owner) {
      if (!triedCreate.current) {
        triedCreate.current = true;
        void createWallet?.().catch(() => undefined);
      }
      return undefined;
    }

    let cancelled = false;
    let es: EventSource | null = null;

    const prevOwner = useRelay.getState().wallet.address;
    const switched = Boolean(prevOwner && prevOwner.toLowerCase() !== owner.toLowerCase());

    useRelay.setState((s) => ({
      wallet: {
        ...s.wallet,
        address: owner,
        connected: true,
        chainId: SHANNON_CHAIN_ID,
        network: "Somnia · Shannon testnet",
      },
      ...(switched ? ownerBoundReset() : {}),
    }));

    (async () => {
      const wallet = pickConnectedWallet(wallets as ConnectedWallet[], owner);
      if (wallet) {
        try {
          const provider = await wallet.getEthereumProvider();
          await assertShannonChain(provider, wallet);
        } catch (e) {
          reportApiError((e as Error).message);
        }
      }
      let net = publicNetwork();
      try {
        net = await relayApi.network();
      } catch (e) {
        reportApiError((e as Error).message);
      }
      if (cancelled) return;
      try {
        await readWalletBalances(net, owner);
      } catch (e) {
        reportApiError((e as Error).message);
      }
      try {
        await refreshRunner(net, owner);
      } catch (e) {
        reportApiError((e as Error).message);
      }
    })();

    let esLive = false;
    let esRetry: number | null = null;
    const pull = () => {
      const nextOwner = ownerFromPrivy({ wallets: ctx.current.wallets, user: ctx.current.user }) ?? owner;
      relayApi
        .network()
        .catch(() => publicNetwork())
        .then(async (net) => {
          await readWalletBalances(net, nextOwner);
          await refreshRunner(net, nextOwner);
        })
        .catch((e) => reportApiError((e as Error).message));
    };
    const poll = window.setInterval(() => {
      if (esLive) return;
      pull();
    }, 8000);
    const clock = window.setInterval(() => {
      useRelay.setState({ now: Date.now() });
    }, 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    const onOnline = () => pull();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    const attachEs = () => {
      try {
        es?.close();
        es = new EventSource(eventsUrl());
        es.onopen = () => {
          esLive = true;
          pull();
        };
        es.onerror = () => {
          esLive = false;
          es?.close();
          if (cancelled) return;
          esRetry = window.setTimeout(attachEs, 3000);
        };
        es.addEventListener("heartbeat", () => pull());
      } catch {
        /* EventSource optional */
      }
    };
    attachEs();
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
      if (esRetry) window.clearTimeout(esRetry);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      es?.close();
    };
  }, [ready, authenticated, walletsReady, owner, createWallet]);

  useEffect(() => {
    if (!isLiveMode() || !ready || !walletsReady) return;
    if (authenticated) return;
    useRelay.setState((s) => ({
      ...ownerBoundReset(),
      wallet: { ...s.wallet, connected: false, address: "", tUSDC: 0, nativeSTT: 0 },
    }));
  }, [ready, authenticated, walletsReady]);

  return null;
}

export function useRelayLogin() {
  const { ready, authenticated, login, logout } = usePrivy();
  return { ready, authenticated, login, logout };
}
