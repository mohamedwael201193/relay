#!/usr/bin/env node
/** Fail if production frontend paths statically import mock/demo datasets. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "frontend", "src");
const allowed = [
  "lib/relay/mock/",
  "lib/relay/engine/mockEngine.ts",
  "lib/relay/engine/engine.ts",
  "components/relay/dev/",
];
const forbidden = /from\s+["']@\/lib\/relay\/mock(?:\/|"|')|from\s+["']\.\.\/mock(?:\/|"|')|from\s+["']\.\.\/\.\.\/lib\/relay\/mock/;
const forbiddenEngine = /from\s+["']@\/lib\/relay\/engine\/engine["']/;

const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const rel = relative(root, p).replaceAll("\\", "/");
    if (allowed.some((a) => rel.startsWith(a))) continue;
    const text = readFileSync(p, "utf8");
    if (forbidden.test(text)) {
      hits.push(rel);
    }
    if (!rel.startsWith("lib/relay/engine/") && forbiddenEngine.test(text)) {
      hits.push(`${rel} (imports mock engine)`);
    }
  }
}

walk(root);
if (hits.length) {
  console.error("production paths import mock data:");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log("mock-import-check PASS");
