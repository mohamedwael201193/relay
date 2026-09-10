# RELAY

Self-driving bounded runners for [DreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) on Somnia.

This repository is **backend, contracts, workers, and the live frontend**.

## Status

Shannon testnet contracts are deployed and a real fill + redeem path has been executed. This is **not** mainnet-ready. Secrets in any chat or local `.env` must be rotated before production.

- App: [https://relay-silk-one.vercel.app](https://relay-silk-one.vercel.app)
- API + worker: [https://relay-api-71gi.onrender.com/health](https://relay-api-71gi.onrender.com/health)

Somnia Shannon only (`chainId` 50312). MetaMask may show a first-visit site warning on the Vercel host — that is the wallet, not a drain. Do not enable `MAINNET_TRADING_ENABLED`. A killed runner cannot be re-deposited; RELAY creates a new vault instead. Tape rows use the Shannon market asset (BTC or ETH), not a hardcoded BTC label. Stake size is `policyStakeRaw` (6% of vault × (1+λ·n), 10% and per-window caps), not the book min lot. Win rate is wins/(wins+losses); voids and open fills are excluded. A `REDEEMED` lap is a verified win on Tape, Result, and streak — not an open fill. BUY_NO stake is complementary NO escrow (`qty × (1 − yes)`), not YES×qty. Arena PnL is verified tape. Boost deploys your own RunnerVault with the leader's bias/cadence/assets — not their wallet. New vaults charge streak shields on-chain (`setShieldsMax`); a consumed charge keeps the streak and wins refill until max. Empty books mint a complete set and dump the unwanted leg when a dump bid exists. Old vaults without that bytecode keep showing shields as not on-chain. Live Lap / Tape / Result show DreamDEX opening, live feed, and resolution USD (never a `$0` placeholder); missing prices render as `—`. The Live Lap 5×5 book is the on-chain YES/NO ladder from `getBinaryOrderBook` (empty books stay empty). After a fill the worker registers the vault on `ReactivityManager` when the shared stake is funded and claims settlement-pending vaults before discover/place so one busy runner cannot starve another. Settings can `setShieldsMax` on the live vault when the bytecode supports it. If a user vault still holds a resolved position, **AUTHORIZE SETTLEMENT** (owner MetaMask) grants the DreamDEX module as ERC-6909 operator once — after that, redeem and lap N+1 are unattended. New vault bytecode grants that operator on place/redeem so the click is not needed again. Oracle question ids deep-link to `prd.oracle.somnia.host`.

Pinned protocol packages:

- `@somnia-chain/markets-sdk@0.29.0`
- `@somnia-chain/reactivity@0.2.1`
- `@somnia-chain/reactivity-contracts@0.2.1`

Networks:

| Network | chainId | Collateral |
| --- | --- | --- |
| Shannon (testnet) | 50312 | tUSDC (6 decimals) |
| Somnia mainnet | 5031 | USDso (18 decimals) |

## Shannon deployment (testnet)

| Contract | Address |
| --- | --- |
| RunnerVault | `0xd762a7719f0e991413038276a37abf7a417d4d59` |
| RelayRegistry | `0xc45689f5d6d0bbd2f87c03a16ead46848d1b2eb0` |
| ReactivityManager | `0x837aab854ed970e1185c674c583fb898be36d889` |

CREATE on Somnia is expensive: bytecode deposit is **3125 gas/byte** (official Somnia gas docs). Do not use the 10M order gas cap for deployments.

## Requirements

- Node.js 20+
- pnpm 10+
- Foundry (`forge`) for contract tests
- A gitignored `.env` copied from `.env.example`

## Setup

```bash
pnpm install
cp .env.example .env
# fill local values — never commit .env
```

Install Foundry libs once:

```bash
git clone --depth 1 https://github.com/foundry-rs/forge-std contracts/lib/forge-std
```

## Commands

```bash
pnpm doctor            # environment + live protocol checks (fail-closed)
pnpm harness           # read-only Shannon SDK + on-chain market/book probe
pnpm faucet            # Shannon STT/tUSDC faucet (SDK realtime path)
pnpm deploy:shannon    # deploy vault/registry/manager
pnpm vault:fund       # deposit/withdraw + scratch kill
pnpm place:shannon     # POST_ONLY then IOC with OrderFilled classification
pnpm settle:shannon    # resolution backstop + redeem
pnpm reactivity:probe  # isolated BlockTick handler (32 STT, then withdraw)
pnpm gold:e2e          # fill → wait → settle/redeem → autonomous lap 2
pnpm db:migrate        # Postgres schema (pooler DATABASE_URL / DIRECT_URL for DDL)
pnpm api               # health + runner/proof/network API
pnpm worker            # single-writer agent with SKIP LOCKED restart reconcile
pnpm start             # API + worker (Render web process)
pnpm render:deploy     # create Free web service via Render API (worker optional)
pnpm test
pnpm typecheck
pnpm check:frontend-mocks
pnpm isolation:owners   # local API: Wallet B cannot start/stop/pause Wallet A's vault
pnpm owner:lifecycle    # provision/deposit/kill/withdraw a second-owner vault; does not touch ops
forge test
```

Doctor prints `PASS` / `WARN` / `FAIL` only. It never prints private keys or passwords.

Environment variable **names** (values stay in gitignored files):

`DEPLOYER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `SOMNIA_SHANNON_RPC_URL`, `SOMNIA_SHANNON_WS_URL`, `SOMNIA_MAINNET_RPC_URL`, `DATABASE_URL`, `DIRECT_URL`, `SHANNON_INDEXER_URL`, `MAINNET_INDEXER_URL`

## Layout

```
apps/api         HTTP health, network, owner-scoped runners, proof/history, SSE heartbeat
apps/worker      Multi-vault agent (discover → fill → settle → re-arm)
packages/core    SDK pin, doctor, deploy, execution, settlement
packages/db      Postgres migrations + SKIP LOCKED leases
contracts/       Foundry (RunnerVault, RelayRegistry, ReactivityManager)
frontend/        Existing designed Next.js app (Privy + live API; no production mocks)
scripts/         operator scripts
```

Public frontend env names: `NEXT_PUBLIC_RELAY_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_CHAIN_ID`. Never put operator/deployer keys or database URLs in `NEXT_PUBLIC_*`. The Next app is its own pnpm workspace (`cd frontend && pnpm install && pnpm exec next build`) so Vercel/CI do not inherit the backend lockfile. Vercel Root Directory is `frontend`; build command is `pnpm exec next build`. Point `NEXT_PUBLIC_RELAY_API_URL` at the Render API and add the Vercel origin to Render `CORS_ORIGINS` plus the Privy allow-list.

`pnpm api` serves CORS for local Next (`http://localhost:3000`) plus `CORS_ORIGINS`. Start/stop/pause require an owner-signed message; kill/withdraw are on-chain `onlyOwner` calls from the wallet. The worker trades only vaults whose on-chain operator is the worker key.

## Safety

- On-chain state is financial truth. The database is not.
- A successful transaction is not a fill. Fills require `OrderFilled` evidence.
- Operator keys cannot withdraw. Owner kill/withdraw stay available.
- Mainnet trading is gated by the Network Doctor, secret rotation, and a capped pilot.

## License

UNLICENSED until otherwise stated.
