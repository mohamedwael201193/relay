# RELAY

Self-driving bounded runners for [DreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) on Somnia.

This repository is **backend, contracts, workers, and proof**. The frontend is built separately.

## Status

Shannon testnet contracts are deployed and a real fill + redeem path has been executed. This is **not** mainnet-ready. Secrets in any chat or local `.env` must be rotated before production.

Live Render web (API + worker in one Free process, `pnpm start`): [https://relay-api-71gi.onrender.com/health](https://relay-api-71gi.onrender.com/health). Do not enable `MAINNET_TRADING_ENABLED`.

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
forge test
```

Doctor prints `PASS` / `WARN` / `FAIL` only. It never prints private keys or passwords.

Environment variable **names** (values stay in gitignored files):

`DEPLOYER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `SOMNIA_SHANNON_RPC_URL`, `SOMNIA_SHANNON_WS_URL`, `SOMNIA_MAINNET_RPC_URL`, `DATABASE_URL`, `DIRECT_URL`, `SHANNON_INDEXER_URL`, `MAINNET_INDEXER_URL`

## Layout

```
apps/api         HTTP health, network, runner proof/history, SSE heartbeat
apps/worker      Single-writer agent (discover → fill → settle → re-arm)
packages/core    SDK pin, doctor, deploy, execution, settlement
packages/db      Postgres migrations + SKIP LOCKED leases
contracts/       Foundry (RunnerVault, RelayRegistry, ReactivityManager)
scripts/         operator scripts
```

## Safety

- On-chain state is financial truth. The database is not.
- A successful transaction is not a fill. Fills require `OrderFilled` evidence.
- Operator keys cannot withdraw. Owner kill/withdraw stay available.
- Mainnet trading is gated by the Network Doctor, secret rotation, and a capped pilot.

## License

UNLICENSED until otherwise stated.
