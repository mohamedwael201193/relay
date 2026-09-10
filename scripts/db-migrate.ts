import { loadEnv } from "@relay/core";
import { migrate, pingDb } from "@relay/db";

loadEnv();
await pingDb();
const m = await migrate();
await pingDb();
console.log(JSON.stringify({ db: "ok", ...m }));
process.exit(0);
