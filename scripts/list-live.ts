import { loadEnv, runShannonHarness } from "@relay/core";

loadEnv();
const result = await runShannonHarness(25);
console.log(JSON.stringify({
  count: result.count,
  rows: result.rows.map((r) => ({
    asset: r.asset,
    intervalSec: r.intervalSec,
    indexer: r.indexerStatus,
    onchain: r.onchainStatus,
    tick: r.tickSize,
    lot: r.lotSize,
    min: r.minQuantity,
    book: r.bookLevels,
    expiry: r.expiry,
  })),
}));
process.exit(0);
