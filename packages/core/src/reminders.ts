import { nextOccurrence } from "./cycle.js";
import { addDays, compareLocalDate, diffDays, parseTimeOfDay, type LocalDate } from "./date.js";
import { decisionId, isBillableOn, type Decision, type Settings, type Subscription } from "./model.js";

export type ReminderKind = "renewal" | "trial-ending";

export interface DueReminder {
  /**
   * Stable identity used for de-duplication:
   * `<subscriptionId>:<chargeDate>:t<threshold>` for a configured threshold, or
   * `<subscriptionId>:<chargeDate>:s<date>` when a snooze expires.
   */
  key: string;
  subscriptionId: string;
  kind: ReminderKind;
  /** The charge date this reminder is about. */
  chargeDate: LocalDate;
  /** Days-before threshold that triggered it, or `null` for an expired snooze. */
  threshold: number | null;
  /** Actual days left until `chargeDate` as of `today`. */
  daysLeft: number;
}

export interface ReminderClock {
  /** Today's civil date in the user's time zone. */
  today: LocalDate;
  /** Minutes since local midnight. */
  minutes: number;
}

export function thresholdKey(subscriptionId: string, chargeDate: LocalDate, threshold: number): string {
  return `${subscriptionId}:${chargeDate}:t${threshold}`;
}

export function snoozeKey(subscriptionId: string, chargeDate: LocalDate, until: LocalDate): string {
  return `${subscriptionId}:${chargeDate}:s${until}`;
}

/** Charge date encoded in a reminder key, used to prune old delivery records. */
export function chargeDateOfKey(key: string): LocalDate | null {
  const m = /:(\d{4}-\d{2}-\d{2}):[ts][\d-]+$/.exec(key);
  return m ? m[1]! : null;
}

/** Live decisions indexed by `decisionId`. */
export type DecisionIndex = ReadonlyMap<string, Decision>;

export function indexDecisions(decisions: readonly Decision[]): Map<string, Decision> {
  const map = new Map<string, Decision>();
  for (const d of decisions) if (!d.deletedAt) map.set(d.id, d);
  return map;
}

/** Whether a civil date has "arrived": earlier days always, today only after `notifyAt`. */
function hasArrived(date: LocalDate, clock: ReminderClock, notifyMinutes: number): boolean {
  const cmp = compareLocalDate(date, clock.today);
  return cmp < 0 || (cmp === 0 && clock.minutes >= notifyMinutes);
}

/** The question currently open for a subscription: its next charge and how urgent it is. */
export interface OpenQuestion {
  subscription: Subscription;
  kind: ReminderKind;
  chargeDate: LocalDate;
  daysLeft: number;
  /** Most urgent threshold already reached, if any. */
  threshold: number | null;
  /** Date that threshold fired. */
  thresholdDate: LocalDate | null;
  decision: Decision | null;
}

function openQuestion(
  sub: Subscription,
  settings: Settings,
  clock: ReminderClock,
  notifyMinutes: number,
  decisions: DecisionIndex,
): OpenQuestion | null {
  if (!isBillableOn(sub, clock.today)) return null;
  const chargeDate = nextOccurrence(sub.anchorDate, sub.cycle, clock.today);
  if (!isBillableOn(sub, chargeDate)) return null;

  const kind: ReminderKind = sub.trialEndsOn && chargeDate === sub.anchorDate ? "trial-ending" : "renewal";
  const thresholds = kind === "trial-ending" ? settings.trialRemindDaysBefore : sub.remindDaysBefore ?? settings.remindDaysBefore;

  let threshold: number | null = null;
  for (const days of thresholds) {
    if (hasArrived(addDays(chargeDate, -days), clock, notifyMinutes) && (threshold === null || days < threshold)) {
      threshold = days;
    }
  }
  return {
    subscription: sub,
    kind,
    chargeDate,
    daysLeft: diffDays(clock.today, chargeDate),
    threshold,
    thresholdDate: threshold === null ? null : addDays(chargeDate, -threshold),
    decision: decisions.get(decisionId(sub.id, chargeDate)) ?? null,
  };
}

/**
 * Reminders that should be shown now and have not been delivered yet.
 *
 * Only each subscription's next charge is considered, and only its most
 * urgent passed threshold: a device that was offline for both the "3 days"
 * and the "1 day" point produces one "1 day" reminder, not two.
 * Same-day thresholds wait until `settings.notifyAt`.
 *
 * A "keep" or "cancel" decision silences the charge. A snooze silences it
 * until its date, then fires once; thresholds after that date fire as usual.
 */
export function computeDueReminders(
  subscriptions: readonly Subscription[],
  settings: Settings,
  clock: ReminderClock,
  delivered: ReadonlySet<string>,
  decisions: DecisionIndex = new Map(),
): DueReminder[] {
  const notifyMinutes = parseTimeOfDay(settings.notifyAt);
  const result: DueReminder[] = [];

  for (const sub of subscriptions) {
    const q = openQuestion(sub, settings, clock, notifyMinutes, decisions);
    if (!q) continue;
    const d = q.decision;
    if (d && d.choice !== "snooze") continue;

    let key: string | null = null;
    let threshold: number | null = null;
    if (d?.choice === "snooze" && d.snoozeUntil) {
      if (!hasArrived(d.snoozeUntil, clock, notifyMinutes)) continue;
      if (q.thresholdDate && compareLocalDate(q.thresholdDate, d.snoozeUntil) >= 0) {
        key = thresholdKey(sub.id, q.chargeDate, q.threshold!);
        threshold = q.threshold;
      } else {
        key = snoozeKey(sub.id, q.chargeDate, d.snoozeUntil);
      }
    } else if (q.threshold !== null) {
      key = thresholdKey(sub.id, q.chargeDate, q.threshold);
      threshold = q.threshold;
    }

    if (!key || delivered.has(key)) continue;
    result.push({ key, subscriptionId: sub.id, kind: q.kind, chargeDate: q.chargeDate, threshold, daysLeft: q.daysLeft });
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface PendingDecision {
  subscription: Subscription;
  kind: ReminderKind;
  chargeDate: LocalDate;
  daysLeft: number;
}

/**
 * Charges the user has been asked about but hasn't answered: a threshold has
 * passed, there's no keep/cancel decision, and no snooze is still running.
 * These stay visible even if the notification was dismissed.
 */
export function pendingDecisions(
  subscriptions: readonly Subscription[],
  settings: Settings,
  clock: ReminderClock,
  decisions: DecisionIndex,
): PendingDecision[] {
  const notifyMinutes = parseTimeOfDay(settings.notifyAt);
  const result: PendingDecision[] = [];
  for (const sub of subscriptions) {
    const q = openQuestion(sub, settings, clock, notifyMinutes, decisions);
    if (!q || q.threshold === null) continue;
    const d = q.decision;
    if (d && d.choice !== "snooze") continue;
    if (d?.snoozeUntil && !hasArrived(d.snoozeUntil, clock, notifyMinutes)) continue;
    result.push({ subscription: sub, kind: q.kind, chargeDate: q.chargeDate, daysLeft: q.daysLeft });
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Snooze presets offered by the UI, clamped so they never pass the charge date. */
export function snoozeOptions(today: LocalDate, chargeDate: LocalDate): { days: number; until: LocalDate }[] {
  const left = diffDays(today, chargeDate);
  const options: { days: number; until: LocalDate }[] = [];
  for (const days of [1, 3, 7]) {
    if (days < left) options.push({ days, until: addDays(today, days) });
  }
  // Always offer "the day before" (or the day itself when it's tomorrow/today).
  const last = left >= 2 ? addDays(chargeDate, -1) : chargeDate;
  if (!options.some((o) => o.until === last) && compareLocalDate(last, today) > 0) {
    options.push({ days: diffDays(today, last), until: last });
  }
  return options;
}

/**
 * Last day of service when the user declines `chargeDate`: the day before it,
 * or today if the charge is already due (it has likely been taken).
 */
export function cancellationEndDate(today: LocalDate, chargeDate: LocalDate): LocalDate {
  return diffDays(today, chargeDate) >= 1 ? addDays(chargeDate, -1) : today;
}
