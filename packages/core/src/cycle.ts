import {
  addDays,
  addMonths,
  compareLocalDate,
  diffCalendarMonths,
  diffDays,
  type LocalDate,
} from "./date.js";

export type CycleUnit = "day" | "week" | "month" | "year";

export const CYCLE_UNITS: readonly CycleUnit[] = ["day", "week", "month", "year"];

/** Bills once every `every` units, e.g. `{ unit: "month", every: 3 }` is quarterly. */
export interface BillingCycle {
  unit: CycleUnit;
  every: number;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  if (typeof value !== "object" || value === null) return false;
  const { unit, every } = value as Record<string, unknown>;
  return (
    CYCLE_UNITS.includes(unit as CycleUnit) &&
    typeof every === "number" &&
    Number.isInteger(every) &&
    every >= 1 &&
    every <= 1000
  );
}

function cycleMonths(cycle: BillingCycle): number {
  return cycle.unit === "year" ? cycle.every * 12 : cycle.every;
}

function cycleDays(cycle: BillingCycle): number {
  return cycle.unit === "week" ? cycle.every * 7 : cycle.every;
}

/**
 * The `k`-th charge date (k = 0 is the anchor).
 *
 * Month-based cycles are always computed from the anchor rather than from the
 * previous charge, so a subscription started on the 31st returns to the 31st
 * after passing through a shorter month.
 */
export function occurrenceAt(anchor: LocalDate, cycle: BillingCycle, k: number): LocalDate {
  if (cycle.unit === "day" || cycle.unit === "week") {
    return addDays(anchor, k * cycleDays(cycle));
  }
  return addMonths(anchor, k * cycleMonths(cycle));
}

/** Index of the first charge on or after `date` (0 when `date` precedes the anchor). */
export function occurrenceIndexOnOrAfter(anchor: LocalDate, cycle: BillingCycle, date: LocalDate): number {
  if (compareLocalDate(date, anchor) <= 0) return 0;
  if (cycle.unit === "day" || cycle.unit === "week") {
    return Math.ceil(diffDays(anchor, date) / cycleDays(cycle));
  }
  const step = cycleMonths(cycle);
  // Calendar-month distance can overshoot by one because of day clamping.
  let k = Math.max(0, Math.floor(diffCalendarMonths(anchor, date) / step) - 1);
  while (compareLocalDate(occurrenceAt(anchor, cycle, k), date) < 0) k++;
  return k;
}

/** The first charge date on or after `date`. */
export function nextOccurrence(anchor: LocalDate, cycle: BillingCycle, date: LocalDate): LocalDate {
  return occurrenceAt(anchor, cycle, occurrenceIndexOnOrAfter(anchor, cycle, date));
}

/** The last charge date strictly before `date`, or `null` if none happened yet. */
export function previousOccurrence(anchor: LocalDate, cycle: BillingCycle, date: LocalDate): LocalDate | null {
  const k = occurrenceIndexOnOrAfter(anchor, cycle, date);
  return k === 0 ? null : occurrenceAt(anchor, cycle, k - 1);
}

/** Charges per year, used to normalise prices across cycles. */
export function chargesPerYear(cycle: BillingCycle): number {
  switch (cycle.unit) {
    case "day":
      return 365 / cycle.every;
    case "week":
      return 52 / cycle.every;
    case "month":
      return 12 / cycle.every;
    case "year":
      return 1 / cycle.every;
  }
}

/** Average monthly cost, in the same unit as `amount`. Not rounded. */
export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  return (amount * chargesPerYear(cycle)) / 12;
}
