import { describe, expect, it } from "vitest";
import { loadEnv } from "@relay/core";
import { claimRunner, ensureRunner, releaseRunner, setRunnerState } from "./lease.js";
import { withPool } from "./pool.js";

loadEnv();

const OWNER = "0x0000000000000000000000000000000000000b0b";

describe.skipIf(!process.env.DATABASE_URL?.trim())("SKIP LOCKED leases", () => {
  it(
    "second claim of the same vault returns null until release",
    async () => {
    const vault = `0x${Date.now().toString(16).padStart(40, "0")}`.slice(0, 42);
    const seeded = await ensureRunner({ vault, owner: OWNER, operator: OWNER });
    await setRunnerState(seeded.id, "ACTIVE");
    try {
      const first = await claimRunner(vault);
      expect(first?.vault.toLowerCase()).toBe(vault.toLowerCase());
      const second = await claimRunner(vault);
      expect(second).toBeNull();
      await releaseRunner(first!.id);
      const third = await claimRunner(vault);
      expect(third?.id).toBe(first!.id);
      await releaseRunner(third!.id);
    } finally {
      await withPool(async (c) => {
        await c.query(`DELETE FROM verification_records WHERE runner_id IN (SELECT id FROM runners WHERE lower(vault)=lower($1))`, [vault]);
        await c.query(`DELETE FROM settlements WHERE lap_id IN (SELECT l.id FROM laps l JOIN runners r ON r.id=l.runner_id WHERE lower(r.vault)=lower($1))`, [vault]);
        await c.query(`DELETE FROM orders WHERE lap_id IN (SELECT l.id FROM laps l JOIN runners r ON r.id=l.runner_id WHERE lower(r.vault)=lower($1))`, [vault]);
        await c.query(`DELETE FROM laps WHERE runner_id IN (SELECT id FROM runners WHERE lower(vault)=lower($1))`, [vault]);
        await c.query(`DELETE FROM runners WHERE lower(vault)=lower($1)`, [vault]);
      });
    }
  },
  20_000,
  );
});
