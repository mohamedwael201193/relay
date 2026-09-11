import { describe, expect, it } from "vitest";
import { oracleHost, oracleQuestionUrl, SHANNON_CHAIN_ID } from "./network";

describe("oracleQuestionUrl", () => {
  it("points Shannon proof links at the testnet Prophecy host", () => {
    expect(oracleQuestionUrl("53883", SHANNON_CHAIN_ID)).toBe(
      "https://dev.oracle.somnia.host/questions/53883?view=graph",
    );
  });

  it("keeps mainnet ids on prd.oracle so Shannon and mainnet do not alias", () => {
    expect(oracleQuestionUrl("53883", 5031)).toBe(
      "https://prd.oracle.somnia.host/questions/53883?view=graph",
    );
    expect(oracleHost(SHANNON_CHAIN_ID)).toBe("dev.oracle.somnia.host");
    expect(oracleHost(5031)).toBe("prd.oracle.somnia.host");
  });
});
