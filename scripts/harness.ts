import { runShannonHarness } from "@relay/core";

const result = await runShannonHarness(5);
console.log(`harness rows=${result.count} at ${result.generatedAt}`);
for (const row of result.rows) {
  console.log(
    `${row.asset ?? "?"} ${row.intervalSec ?? "?"}s indexer=${row.indexerStatus} onchain=${row.onchainStatus} tick=${row.tickSize} lot=${row.lotSize} min=${row.minQuantity} voidPolicy=${row.voidPolicy} book=${row.bookLevels ? `${row.bookLevels.bids}/${row.bookLevels.asks}` : "n/a"}`,
  );
}
process.exit(0);
