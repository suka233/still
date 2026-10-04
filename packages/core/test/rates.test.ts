import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, convertTotals, parseRatesPayload, validateSettingsPatch } from "../src/index.js";

const rates = parseRatesPayload({ base_code: "USD", rates: { USD: 1, CNY: 7.1, JPY: 150, bad: 2, EUR: -1 } }, "t", "test")!;

describe("exchange rates", () => {
  it("parses and sanitises payloads", () => {
    expect(rates.base).toBe("USD");
    expect(Object.keys(rates.rates).sort()).toEqual(["CNY", "JPY", "USD"]);
    expect(parseRatesPayload({ nope: 1 }, "t", "x")).toBeNull();
  });

  it("converts across currencies with different exponents", () => {
    // $10.00 + ¥71.00 + ¥1500 (JPY) → CNY
    expect(convertTotals({ USD: 1000, CNY: 7100, JPY: 1500 }, "CNY", rates)).toEqual({ amount: 7100 + 7100 + 7100, unconverted: {} });
    expect(convertTotals({ USD: 1000, TWD: 5000 }, "USD", rates)).toEqual({ amount: 1000, unconverted: { TWD: 5000 } });
    expect(convertTotals({ USD: 1000 }, "CNY", null)).toEqual({ amount: 0, unconverted: { USD: 1000 } });
  });
});

describe("appearance settings", () => {
  it("merges and validates", () => {
    const r = validateSettingsPatch({ appearance: { theme: "paper", accent: "#ff0066" } }, DEFAULT_SETTINGS);
    expect(r.ok && r.value.appearance).toEqual({ theme: "paper", mode: "auto", accent: "#ff0066" });
    expect(validateSettingsPatch({ appearance: { mode: "neon" } }, DEFAULT_SETTINGS).ok).toBe(false);
    expect(validateSettingsPatch({ appearance: { accent: "red" } }, DEFAULT_SETTINGS).ok).toBe(false);
  });
});
