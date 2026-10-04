import { monthlyEquivalent, nextOccurrence, occurrenceAt } from "./cycle.js";
import { addDays, compareLocalDate, diffDays, type LocalDate } from "./date.js";
import { isBillableOn, type Decision, type Subscription } from "./model.js";

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

const MAX_COUNTED_CHARGES = 5000;

/** Number of charges in `[from, to]` (inclusive) on the subscription's schedule. */
function countCharges(sub: Subscription, from: LocalDate, to: LocalDate): number {
  if (compareLocalDate(from, to) > 0) return 0;
  let count = 0;
  let date = nextOccurrence(sub.anchorDate, sub.cycle, from);
  while (count < MAX_COUNTED_CHARGES && compareLocalDate(date, to) <= 0) {
    count++;
    date = nextOccurrence(sub.anchorDate, sub.cycle, addDays(date, 1));
  }
  return count;
}

export interface PaidEstimate {
  /** Charges assumed to have happened so far. */
  count: number;
  /** `count × current price`, in minor units of `sub.price.currency`. */
  amount: number;
}

/**
 * Rough lifetime spend, assuming the current price was always charged.
 * Counts charges from the anchor up to today (or the end of service).
 */
export function estimatePaid(sub: Subscription, today: LocalDate): PaidEstimate {
  const until = sub.endDate && compareLocalDate(sub.endDate, today) < 0 ? sub.endDate : today;
  const count = countCharges(sub, sub.anchorDate, until);
  return { count, amount: count * sub.price.amount };
}

/** First charge date as a convenience for "since …" labels. */
export function firstChargeDate(sub: Subscription): LocalDate {
  return occurrenceAt(sub.anchorDate, sub.cycle, 0);
}

/**
 * Money not spent thanks to "cancel" decisions: every charge that would have
 * happened from the declined charge date up to today, per currency.
 */
export function estimateSaved(
  subscriptions: readonly Subscription[],
  decisions: readonly Decision[],
  today: LocalDate,
): { totals: Record<string, number>; cancelled: number } {
  const byId = new Map(subscriptions.map((s) => [s.id, s]));
  const totals: Record<string, number> = {};
  let cancelled = 0;
  for (const d of decisions) {
    if (d.deletedAt || d.choice !== "cancel") continue;
    const sub = byId.get(d.subscriptionId);
    if (!sub || sub.deletedAt || sub.status !== "cancelled") continue;
    cancelled++;
    const count = countCharges(sub, d.chargeDate, today);
    if (count > 0) totals[sub.price.currency] = (totals[sub.price.currency] ?? 0) + count * sub.price.amount;
  }
  return { totals, cancelled };
}

// Plain code-unit ordering: deterministic in every runtime, including goja.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
