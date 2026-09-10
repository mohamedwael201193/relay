import { createServer } from "node:http";
import { loadEnv } from "@relay/core";
import { withPool } from "@relay/db";

loadEnv();

const port = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  res.setHeader("content-type", "application/json");
  try {
    if (url.pathname === "/health") {
      await withPool((c) => c.query("SELECT 1"));
      res.end(JSON.stringify({ ok: true, service: "relay-api" }));
      return;
    }
    if (url.pathname.startsWith("/v1/runners/")) {
      const vault = url.pathname.slice("/v1/runners/".length).toLowerCase();
      const row = await withPool(async (c) => {
        const r = await c.query(
          `SELECT id, vault, owner, operator, state, chain_id, updated_at FROM runners WHERE lower(vault)=$1`,
          [vault],
        );
        return r.rows[0] ?? null;
      });
      if (!row) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      res.end(JSON.stringify(row));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found" }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "internal", category: (e as Error).name }));
  }
});

server.listen(port, () => {
  console.log(JSON.stringify({ listening: port }));
});
