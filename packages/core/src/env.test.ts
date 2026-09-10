import { describe, expect, it } from "vitest";
import { normalizePrivateKey, redactUrl } from "./env.js";

describe("env helpers", () => {
  it("prefixes 0x on 64-char hex", () => {
    const raw = "a".repeat(64);
    expect(normalizePrivateKey(raw)).toBe(`0x${raw}`);
  });

  it("rejects short keys without logging", () => {
    expect(() => normalizePrivateKey("abcd")).toThrow(/not 32-byte hex/);
  });

  it("redacts userinfo from URLs", () => {
    expect(redactUrl("postgresql://user:secret@host:6543/postgres")).toContain("***");
    expect(redactUrl("postgresql://user:secret@host:6543/postgres")).not.toContain("secret");
  });
});
