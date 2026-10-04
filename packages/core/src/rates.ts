import { currencyExponent } from "./money.js";

/** Exchange rates: units of each currency per one unit of `base`. */
export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  /** ISO instant the rates were fetched. */
  fetchedAt: string;
  /** Human-readable source, shown for attribution. */
  source: string;
}

/** Converts a major-unit amount between currencies; `null` when either rate is unknown. */
export function convertMajor(amount: number, from: string, to: string, rates: ExchangeRates): number | null {
  if (from === to) return amount;
  const rFrom = from === rates.base ? 1 : rates.rates[from];
  const rTo = to === rates.base ? 1 : rates.rates[to];
  if (!rFrom || !rTo) return null;
  return (amount / rFrom) * rTo;
}

/**
 * Collapses per-currency minor-unit totals into one `target` total.
 * Currencies without a rate are returned separately instead of guessed.
 */
export function convertTotals(
  totals: Record<string, number>,
  target: string,
  rates: ExchangeRates | null,
): { amount: number; unconverted: Record<string, number> } {
  let amount = 0;
  const unconverted: Record<string, number> = {};
  for (const [currency, minor] of Object.entries(totals)) {
    if (currency === target) {
      amount += minor;
      continue;
    }
    const major = minor / 10 ** currencyExponent(currency);
    const converted = rates ? convertMajor(major, currency, target, rates) : null;
    if (converted === null) unconverted[currency] = minor;
    else amount += Math.round(converted * 10 ** currencyExponent(target));
  }
  return { amount, unconverted };
}

/** Parses an open.er-api.com / exchangerate-api style payload. */
export function parseRatesPayload(payload: unknown, fetchedAt: string, source: string): ExchangeRates | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const base = typeof p.base_code === "string" ? p.base_code : typeof p.base === "string" ? p.base : null;
  const rates = p.rates;
  if (!base || typeof rates !== "object" || rates === null) return null;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(k) && typeof v === "number" && v > 0 && Number.isFinite(v)) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return null;
  return { base, rates: clean, fetchedAt, source };
}
