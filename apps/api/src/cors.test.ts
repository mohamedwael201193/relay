import { describe, expect, it } from "vitest";
import { allowOrigin, CORS_ALLOW_HEADERS, parseCorsOrigins } from "./cors.js";

describe("CORS allow-list", () => {
  it("always includes local Next dev origins", () => {
    const allowed = parseCorsOrigins("");
    expect(allowed).toContain("http://localhost:3000");
    expect(allowOrigin("http://localhost:3000", allowed)).toBe("http://localhost:3000");
  });

  it("always includes the Vercel production origin", () => {
    const allowed = parseCorsOrigins("");
    expect(allowOrigin("https://relay-silk-one.vercel.app", allowed)).toBe(
      "https://relay-silk-one.vercel.app",
    );
  });

  it("allows the frontend request-id header", () => {
    expect(CORS_ALLOW_HEADERS).toContain("x-relay-request-id");
  });

  it("does not wildcard unknown origins", () => {
    const allowed = parseCorsOrigins("https://relay.example");
    expect(allowOrigin("https://evil.example", allowed)).toBeNull();
    expect(allowOrigin("https://relay.example", allowed)).toBe("https://relay.example");
  });

  it("allows this project's Vercel preview hosts", () => {
    const allowed = parseCorsOrigins("");
    expect(
      allowOrigin("https://relay-n6es4zjyk-mohamedwael201193s-projects.vercel.app", allowed),
    ).toBe("https://relay-n6es4zjyk-mohamedwael201193s-projects.vercel.app");
    expect(allowOrigin("https://evil-mohamedwael201193s-projects.vercel.app", allowed)).toBeNull();
  });
});
