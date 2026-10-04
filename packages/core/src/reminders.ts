import { nextOccurrence } from "./cycle.js";
import { addDays, compareLocalDate, diffDays, parseTimeOfDay, type LocalDate } from "./date.js";
import { isBillableOn, type Settings, type Subscription } from "./model.js";

export type ReminderKind = "renewal" | "trial-ending";

export interface DueReminder {
  /**
   * Stable identity used for de-duplication:
   * `<subscriptionId>:<chargeDate>:<threshold>`.
   */
  key: string;
  subscriptionId: string;
  kind: ReminderKind;
  /** The charge date this reminder is about. */
  chargeDate: LocalDate;
  /** The configured threshold that triggered it (e.g. 3 for "3 days before"). */
  threshold: number;
  /** Actual days left until `chargeDate` as of `today`. */
  daysLeft: number;
}

export interface ReminderClock {
  /** Today's civil date in the user's time zone. */
  today: LocalDate;
  /** Minutes since local midnight. */
  minutes: number;
}

export function reminderKey(subscriptionId: string, chargeDate: LocalDate, threshold: number): string {
  return `${subscriptionId}:${chargeDate}:${threshold}`;
}

/** Charge date encoded in a reminder key, used to prune old delivery records. */
export function chargeDateOfKey(key: string): LocalDate | null {
  const m = /:(\d{4}-\d{2}-\d{2}):\d+$/.exec(key);
  return m ? m[1]! : null;
}

/**
 * Reminders that should be shown now and have not been delivered yet.
 *
 * For each subscription only the next charge is considered, and only its most
 * urgent passed threshold: if a device was offline for both the "3 days" and
 * the "1 day" point, the user gets a single "1 day" reminder, not two.
 * Thresholds that fall on today wait until `settings.notifyAt`.
 */
export function computeDueReminders(
  subscriptions: readonly Subscription[],
  settings: Settings,
  clock: ReminderClock,
  delivered: ReadonlySet<string>,
): DueReminder[] {
  const notifyMinutes = parseTimeOfDay(settings.notifyAt);
  const result: DueReminder[] = [];

  for (const sub of subscriptions) {
    if (!isBillableOn(sub, clock.today)) continue;
    const chargeDate = nextOccurrence(sub.anchorDate, sub.cycle, clock.today);
    if (!isBillableOn(sub, chargeDate)) continue;

    const isTrialConversion = Boolean(sub.trialEndsOn) && chargeDate === sub.anchorDate;
    const thresholds = isTrialConversion
      ? settings.trialRemindDaysBefore
      : sub.remindDaysBefore ?? settings.remindDaysBefore;

    let threshold: number | null = null;
    for (const days of thresholds) {
      const fireDate = addDays(chargeDate, -days);
      const cmp = compareLocalDate(fireDate, clock.today);
      const reached = cmp < 0 || (cmp === 0 && clock.minutes >= notifyMinutes);
      if (reached && (threshold === null || days < threshold)) threshold = days;
    }
    if (threshold === null) continue;

    const key = reminderKey(sub.id, chargeDate, threshold);
    if (delivered.has(key)) continue;
    result.push({
      key,
      subscriptionId: sub.id,
      kind: isTrialConversion ? "trial-ending" : "renewal",
      chargeDate,
      threshold,
      daysLeft: diffDays(clock.today, chargeDate),
    });
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}
