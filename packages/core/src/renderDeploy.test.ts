import { describe, expect, it } from "vitest";
import {
  billingRequired,
  pickOwner,
  shouldCreateBackgroundWorker,
  webDeploySucceeded,
} from "./renderDeploy.js";

describe("pickOwner", () => {
  const team = { id: "tea-old", name: "0xelan's workspace", type: "team" };
  const hobby = { id: "tea-new", name: "relay-shannon", type: "team" };

  it("prefers RENDER_OWNER_NAME", () => {
    expect(pickOwner([team, hobby], "relay-shannon")?.id).toBe("tea-new");
  });

  it("defaults to relay-shannon when present", () => {
    expect(pickOwner([team, hobby])?.id).toBe("tea-new");
  });

  it("falls back to the first owner", () => {
    expect(pickOwner([team])?.id).toBe("tea-old");
  });
});

describe("webDeploySucceeded", () => {
  it("treats a created web service as enough (worker optional)", () => {
    expect(webDeploySucceeded({ name: "relay-api", id: "srv-abc", httpStatus: 201 })).toBe(true);
  });

  it("rejects 402 even if a body looks like an id", () => {
    expect(
      webDeploySucceeded({ name: "relay-api", id: null, httpStatus: 402, error: "Payment information is required" }),
    ).toBe(false);
  });
});

describe("billingRequired", () => {
  it("detects HTTP 402 and official payment copy", () => {
    expect(billingRequired(402, "Payment information is required to use this feature")).toBe(true);
    expect(billingRequired(201, null)).toBe(false);
  });
});

describe("shouldCreateBackgroundWorker", () => {
  it("is off unless RENDER_CREATE_WORKER=true (Free web has no worker plan)", () => {
    expect(shouldCreateBackgroundWorker(undefined)).toBe(false);
    expect(shouldCreateBackgroundWorker("true")).toBe(true);
  });
});
