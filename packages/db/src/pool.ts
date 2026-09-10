import { readdirSync, readFileSync } from "node:fs";
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

export async function migrate(): Promise<{ applied: string[] }> {
  const url = process.env.DIRECT_URL?.trim() || databaseUrl();
  const dir = resolve(process.cwd(), "packages/db/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8");
      await client.query(sql);
    }
    return { applied: files };
  } finally {
    client.release();
    await pool.end();
  }
}
