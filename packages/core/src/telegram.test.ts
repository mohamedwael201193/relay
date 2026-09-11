import { describe, expect, it, vi } from "vitest";
import { sendTelegram, telegramLapText } from "./telegram.js";

describe("telegramLapText", () => {
  it("formats a redeemed win from receipts only", () => {
    const text = telegramLapText({
      vault: "0x25cdBDbE9ca3eC7ea027D422dFA5440c0Dc9D133",
      lapIndex: 8,
      state: "REDEEMED",
      pnlRaw: "105042",
      asset: "BTC",
      intervalSec: "900",
      fillTx: "0x46fccd3f24f34bd7417e45e37ebebf126e8e398edbf09177bf68d550fca1588f",
      redeemTx: "0xabc",
      fromCallback: true,
    });
    expect(text).toContain("Lap 8 complete +$0.11");
    expect(text).toContain("BTC 15m");
    expect(text).toContain("0x25cd…D133");
    expect(text).toContain("Reactivity callback settled this lap");
    expect(text).not.toContain("NaN");
  });

  it("labels a shielded loss without inventing a win", () => {
    const text = telegramLapText({
      vault: "0x25cdBDbE9ca3eC7ea027D422dFA5440c0Dc9D133",
      lapIndex: 1,
      state: "SETTLED_LOSS",
      pnlRaw: "-599256",
      shielded: true,
      asset: "BTC",
      intervalSec: "60",
    });
    expect(text).toContain("shield absorbed −$0.60");
    expect(text).not.toContain("complete");
  });
});

describe("sendTelegram", () => {
  it("skips when token or chat is unset", async () => {
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevChat = process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const fetchImpl = vi.fn();
    await expect(sendTelegram("hello", fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      ok: true,
      skipped: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    if (prevToken) process.env.TELEGRAM_BOT_TOKEN = prevToken;
    if (prevChat) process.env.TELEGRAM_CHAT_ID = prevChat;
  });
});
