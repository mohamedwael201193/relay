#!/usr/bin/env node
/** Fail if a Next production client bundle contains server secrets. */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const candidates = [
  join(process.cwd(), "frontend", ".next", "static"),
  join(process.cwd(), ".next", "static"),
];
const root = candidates.find((p) => existsSync(p));
if (!root) {
  console.error("no .next/static output to scan");
  process.exit(1);
}

const needles = [
  /privy_app_secret_/i,
  /DEPLOYER_PRIVATE_KEY/,
  /OPERATOR_PRIVATE_KEY/,
  /BEGIN RSA PRIVATE KEY/,
  /postgres:\/\//i,
  /SERVICE_ROLE/,
  /RENDER_API_KEY/,
  /GITHUB_TOKEN/,
];

const skipDir = new Set(["cache", "node_modules"]);
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipDir.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(js|html)$/i.test(name)) continue;
    if (st.size > 4_000_000) continue;
    const text = readFileSync(p, "utf8");
    for (const n of needles) {
      if (n.test(text)) hits.push(`${p} ~ ${n}`);
    }
  }
}

walk(root);
if (hits.length) {
  console.error("secret-like strings in frontend bundle:");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log("frontend-bundle-secret-scan PASS");
