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
