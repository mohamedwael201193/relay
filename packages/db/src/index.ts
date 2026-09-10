import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL missing");
  if (/:5432\//.test(url) && !url.includes("6543")) {
    throw new Error("runtime must use pooler DATABASE_URL, not DIRECT_URL");
  }
  return url;
}

export async function withPool<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: databaseUrl(), max: 5 });
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

export async function pingDb(): Promise<{ ok: true }> {
  return withPool(async (c) => {
    await c.query("SELECT 1");
    return { ok: true as const };
  });
}

export async function migrate(): Promise<{ applied: string }> {
  const sql = readFileSync(resolve(process.cwd(), "packages/db/migrations/001_init.sql"), "utf8");
  return withPool(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query(sql);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
    return { applied: "001_init.sql" };
  });
}

export { persistShannonGold } from "./persistGold.js";
