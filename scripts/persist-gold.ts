import { loadEnv } from "@relay/core";
import { persistShannonGold } from "@relay/db";

loadEnv();
const out = await persistShannonGold();
console.log(JSON.stringify(out));
process.exit(0);
