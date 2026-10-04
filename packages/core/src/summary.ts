import { monthlyEquivalent, nextOccurrence } from "./cycle.js";
import { addDays, compareLocalDate, diffDays, type LocalDate } from "./date.js";
import { isBillableOn, type Subscription } from "./model.js";

export interface UpcomingCharge {
  subscription: Subscription;
  chargeDate: LocalDate;
  daysLeft: number;
}

/** Live subscriptions with their next charge, soonest first. Ended ones are dropped. */
export function upcomingCharges(subscriptions: readonly Subscription[], today: LocalDate): UpcomingCharge[] {
  const result: UpcomingCharge[] = [];
  for (const sub of subscriptions) {
    if (!isBillableOn(sub, today)) continue;
    const chargeDate = nextOccurrence(sub.anchorDate, sub.cycle, today);
    if (!isBillableOn(sub, chargeDate)) continue;
    result.push({ subscription: sub, chargeDate, daysLeft: diffDays(today, chargeDate) });
  }
  return result.sort(
    (a, b) => compareLocalDate(a.chargeDate, b.chargeDate) || compareText(a.subscription.name, b.subscription.name),
  );
}

/**
 * Average monthly spend per currency, in minor units (rounded).
 * Currencies are kept apart; converting needs exchange rates the caller supplies.
 */
export function monthlyTotals(subscriptions: readonly Subscription[], today: LocalDate): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const sub of subscriptions) {
    if (!isBillableOn(sub, today)) continue;
    const { currency, amount } = sub.price;
    totals[currency] = (totals[currency] ?? 0) + monthlyEquivalent(amount, sub.cycle);
  }
  for (const currency of Object.keys(totals)) totals[currency] = Math.round(totals[currency]!);
  return totals;
}

/** Sum of charges actually due in `[from, to]` (inclusive), per currency, in minor units. */
export function chargesBetween(
  subscriptions: readonly Subscription[],
  from: LocalDate,
  to: LocalDate,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const sub of subscriptions) {
    let date = nextOccurrence(sub.anchorDate, sub.cycle, from);
    // Guard against pathological ranges; 1000 charges is far beyond any real window.
    for (let i = 0; i < 1000 && compareLocalDate(date, to) <= 0; i++) {
      if (!isBillableOn(sub, date)) break;
      totals[sub.price.currency] = (totals[sub.price.currency] ?? 0) + sub.price.amount;
      date = nextOccurrence(sub.anchorDate, sub.cycle, addDays(date, 1));
    }
  }
  return totals;
}

// Plain code-unit ordering: deterministic in every runtime, including goja.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
