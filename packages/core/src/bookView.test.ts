import { describe, expect, it } from "vitest";
import { humanBinaryBook } from "./bookView.js";

describe("humanBinaryBook", () => {
  it("scales 6dp YES/NO levels and derives spread in probability terms", () => {
    const book = humanBinaryBook(
      {
        yesBids: [{ price: 470_000n, quantity: 2_000_000n }],
        yesAsks: [{ price: 490_000n, quantity: 1_500_000n }],
        noBids: [{ price: 510_000n, quantity: 1_500_000n }],
        noAsks: [{ price: 530_000n, quantity: 2_000_000n }],
      },
      6,
      5,
    );
    expect(book.bidUp).toEqual([{ price: 0.47, size: 2 }]);
    expect(book.askUp).toEqual([{ price: 0.49, size: 1.5 }]);
    expect(book.spread).toBeCloseTo(0.02);
    expect(book.bidDown[0]?.price).toBe(0.51);
  });

  it("does not invent a spread when one side is empty", () => {
    const book = humanBinaryBook({ yesBids: [{ price: 500_000n, quantity: 1_000_000n }], yesAsks: [] }, 6);
    expect(book.askUp).toEqual([]);
    expect(book.spread).toBeNull();
  });
});
