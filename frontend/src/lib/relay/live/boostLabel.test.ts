import { describe, expect, it } from "vitest";
import { boostLabel } from "./boostLabel";

describe("boostLabel", () => {
  it("does not treat a wallet signature as an on-chain boost", () => {
    expect(boostLabel("waiting", "Signature required", false, false)).toBe("SIGNATURE REQUIRED");
    expect(boostLabel("signing", "Creating vault", false, false)).toBe("SIGNATURE REQUIRED");
    expect(boostLabel("submitting", "Provisioning vault", false, false)).toBe("PROVISIONING");
    expect(boostLabel("submitting", "deposit", false, false)).toBe("SIGNATURE ACCEPTED");
    expect(boostLabel("confirming", "Starting runner", false, false)).toBe("ON-CHAIN CONFIRMING");
    expect(boostLabel("confirmed", "Confirmed", false, false)).toBe("VERIFYING CHILD");
    expect(boostLabel("confirmed", "Confirmed", false, true)).toBe("BOOST COMPLETE");
  });
});
