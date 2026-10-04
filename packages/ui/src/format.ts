import { toMajor, type BillingCycle, type Money } from "@still/core";
import type { Translate } from "./i18n/index.js";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware currency formatting; `amount` is in minor units. */
export function formatMoney(money: Money, locale: string): string {
  const key = `${locale}|${money.currency}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, { style: "currency", currency: money.currency });
    } catch {
      fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 });
    }
    moneyFormatters.set(key, fmt);
  }
  return fmt.format(toMajor(money.amount, money.currency));
}

export function formatCycle(cycle: BillingCycle, t: Translate): string {
  const specific = `cycle.${cycle.unit}.${cycle.every}`;
  if (specific === "cycle.day.1" || specific === "cycle.week.1" || specific === "cycle.month.1" || specific === "cycle.month.3" || specific === "cycle.year.1") {
    return t(specific);
  }
  return t(`cycle.${cycle.unit}`, { n: cycle.every });
}

export function formatDaysLeft(days: number, t: Translate): string {
  if (days <= 0) return t("today");
  if (days === 1) return t("tomorrow");
  return t("inDays", { n: days });
}

/** A civil date as a local-midnight `Date`, for `Intl` formatting only. */
export function localToDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatDate(date: string, locale: string, options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat(locale, options).format(localToDate(date));
}

/** Common currencies first; the select still accepts any ISO 4217 code. */
export const COMMON_CURRENCIES = ["USD", "CNY", "EUR", "GBP", "JPY", "HKD", "TWD", "KRW", "SGD", "CAD", "AUD", "INR", "RUB", "TRY", "BRL", "CHF"];

/** A sensible default currency for a locale, used on first run. */
export function guessCurrency(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh-tw") || l.startsWith("zh-hant")) return "TWD";
  if (l.startsWith("zh-hk") || l.startsWith("zh-mo")) return "HKD";
  if (l.startsWith("zh")) return "CNY";
  if (l.startsWith("ja")) return "JPY";
  if (l.startsWith("ko")) return "KRW";
  if (l.startsWith("ru")) return "RUB";
  if (l.startsWith("tr")) return "TRY";
  if (l.startsWith("pt-br")) return "BRL";
  if (l === "en-gb") return "GBP";
  if (/^(de|fr|es|it|nl|pt|fi|el|sk|sl|et|lv|lt)\b/.test(l)) return "EUR";
  return "USD";
}
