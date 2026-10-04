import {
  addDays,
  chargesBetween,
  chargesInRange,
  convertTotals,
  estimateSaved,
  indexDecisions,
  monthlyEquivalent,
  monthlyTotals,
  pendingDecisions,
  upcomingCharges,
} from "@still/core";
import { useMemo } from "react";
import { useStill } from "../context.js";

export function useUpcoming() {
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  return useMemo(() => upcomingCharges(subscriptions, today), [subscriptions, today]);
}

export function useTotals() {
  const subscriptions = useStill((s) => s.subscriptions);
  const decisions = useStill((s) => s.decisions);
  const today = useStill((s) => s.today);
  return useMemo(() => {
    const monthly = monthlyTotals(subscriptions, today);
    return {
      monthly,
      yearly: Object.fromEntries(Object.entries(monthly).map(([c, v]) => [c, v * 12])),
      next30Days: chargesBetween(subscriptions, today, addDays(today, 30)),
      next30Count: chargesInRange(subscriptions, today, addDays(today, 30)).length,
      saved: estimateSaved(subscriptions, decisions, today),
    };
  }, [subscriptions, decisions, today]);
}

/**
 * Per-currency totals folded into the default currency, when conversion is
 * on and rates are available. `null` means "show per currency".
 */
export function useConverted(totals: Record<string, number>) {
  const settings = useStill((s) => s.settings);
  const rates = useStill((s) => s.rates);
  return useMemo(() => {
    const currencies = Object.keys(totals);
    if (currencies.length <= 1 || !settings.convertCurrency || !rates) return null;
    const { amount, unconverted } = convertTotals(totals, settings.defaultCurrency, rates);
    return { amount, currency: settings.defaultCurrency, unconverted };
  }, [totals, settings.convertCurrency, settings.defaultCurrency, rates]);
}

/** Monthly-equivalent cost of one subscription in the default currency (or its own). */
export function useMonthlyCostIn() {
  const settings = useStill((s) => s.settings);
  const rates = useStill((s) => s.rates);
  return useMemo(
    () => (amount: number, currency: string, cycle: Parameters<typeof monthlyEquivalent>[1]) => {
      const monthly = Math.round(monthlyEquivalent(amount, cycle));
      if (!settings.convertCurrency || !rates || currency === settings.defaultCurrency) return { amount: monthly, currency };
      const { amount: converted, unconverted } = convertTotals({ [currency]: monthly }, settings.defaultCurrency, rates);
      return Object.keys(unconverted).length ? { amount: monthly, currency } : { amount: converted, currency: settings.defaultCurrency };
    },
    [settings.convertCurrency, settings.defaultCurrency, rates],
  );
}

export function useDecisionIndex() {
  const decisions = useStill((s) => s.decisions);
  return useMemo(() => indexDecisions(decisions), [decisions]);
}

/** Charges the user was asked about and hasn't answered yet. */
export function usePending() {
  const subscriptions = useStill((s) => s.subscriptions);
  const settings = useStill((s) => s.settings);
  const clock = useStill((s) => s.clock);
  const index = useDecisionIndex();
  return useMemo(() => pendingDecisions(subscriptions, settings, clock, index), [subscriptions, settings, clock, index]);
}

function sumCharges(charges: { subscription: { price: { amount: number; currency: string } } }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const c of charges) totals[c.subscription.price.currency] = (totals[c.subscription.price.currency] ?? 0) + c.subscription.price.amount;
  return totals;
}

function monthBounds(date: string) {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** This calendar month: what's already been charged and what's still to come. */
export function useMonthOverview() {
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  return useMemo(() => {
    const { start, end } = monthBounds(today);
    const paid = today === start ? {} : sumCharges(chargesInRange(subscriptions, start, addDays(today, -1)));
    const upcoming = chargesInRange(subscriptions, today, end);
    return { paid, remaining: sumCharges(upcoming), remainingCount: upcoming.length };
  }, [subscriptions, today]);
}

/** Expected charges per calendar month, starting with the current one. */
export function useForecast(months = 6) {
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  return useMemo(() => {
    const out: { month: string; totals: Record<string, number> }[] = [];
    let cursor = `${today.slice(0, 7)}-01`;
    for (let i = 0; i < months; i++) {
      const { start, end } = monthBounds(cursor);
      out.push({ month: cursor.slice(0, 7), totals: sumCharges(chargesInRange(subscriptions, i === 0 ? today : start, end)) });
      const [y, m] = cursor.split("-").map(Number) as [number, number];
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
    return out;
  }, [subscriptions, today, months]);
}

/** Folds per-currency totals into one number in the default currency when possible. */
export function useFold() {
  const settings = useStill((s) => s.settings);
  const rates = useStill((s) => s.rates);
  return useMemo(
    () => (totals: Record<string, number>) => {
      const entries = Object.entries(totals);
      if (entries.length === 0) return { amount: 0, currency: settings.defaultCurrency, exact: true, partial: false };
      if (entries.length === 1) return { amount: entries[0]![1], currency: entries[0]![0], exact: true, partial: false };
      if (settings.convertCurrency && rates) {
        const { amount, unconverted } = convertTotals(totals, settings.defaultCurrency, rates);
        return { amount, currency: settings.defaultCurrency, exact: false, partial: Object.keys(unconverted).length > 0 };
      }
      const [currency, amount] = entries.sort((a, b) => b[1] - a[1])[0]!;
      return { amount, currency, exact: true, partial: true };
    },
    [settings.convertCurrency, settings.defaultCurrency, rates],
  );
}
