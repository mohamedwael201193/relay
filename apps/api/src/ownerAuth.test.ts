import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { ownerMessage, recoverOwner, timestampFresh } from "./ownerAuth.js";

const PK = "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("ownerAuth", () => {
  it("recovers the signer of a RELAY owner message", async () => {
    const account = privateKeyToAccount(PK);
    const ts = 1_700_000_000_000;
    const message = ownerMessage("start", "0xD762A7719F0E991413038276A37ABF7A417D4D59", ts);
    const signature = await account.signMessage({ message });
    const recovered = await recoverOwner(message, signature);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("rejects stale timestamps", () => {
    expect(timestampFresh(Date.now() - 11 * 60_000, Date.now())).toBe(false);
    expect(timestampFresh(Date.now(), Date.now())).toBe(true);
  });
});
