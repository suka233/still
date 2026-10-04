/**
 * Money is stored as an integer count of minor units (cents, fen, …) next to an
 * ISO 4217 code, so sums never accumulate floating-point error.
 */
export interface Money {
  /** Integer amount in the currency's minor unit. */
  amount: number;
  /** ISO 4217 code, upper case. */
  currency: string;
}

const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

const CURRENCY_RE = /^[A-Z]{3}$/;

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && CURRENCY_RE.test(value);
}

/** Number of minor-unit digits for a currency (2 unless known otherwise). */
export function currencyExponent(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== "object" || value === null) return false;
  const { amount, currency } = value as Record<string, unknown>;
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && isCurrencyCode(currency);
}

const DECIMAL_RE = /^\s*(\d+)(?:[.,](\d*))?\s*$/;

/**
 * Parses a user-entered decimal ("9.99", "1280", "12,5") into minor units
 * without going through floating point. Returns `null` on invalid input or
 * when there are more fraction digits than the currency allows.
 */
export function parseMoneyInput(input: string, currency: string): Money | null {
  const m = DECIMAL_RE.exec(input);
  if (!m) return null;
  const exponent = currencyExponent(currency);
  const fraction = m[2] ?? "";
  if (fraction.length > exponent) return null;
  const amount = Number(m[1] + fraction.padEnd(exponent, "0"));
  if (!Number.isSafeInteger(amount)) return null;
  return { amount, currency };
}

/** Minor units → plain decimal string, e.g. `{999, USD}` → `"9.99"`. */
export function formatMoneyAmount(money: Money): string {
  const exponent = currencyExponent(money.currency);
  if (exponent === 0) return String(money.amount);
  const digits = String(money.amount).padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

/** Minor units → major units as a float, for display maths only. */
export function toMajor(amount: number, currency: string): number {
  return amount / 10 ** currencyExponent(currency);
}
