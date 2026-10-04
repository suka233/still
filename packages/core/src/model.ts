import { isBillingCycle, type BillingCycle } from "./cycle.js";
import { compareLocalDate, isLocalDate, isTimeOfDay, type LocalDate } from "./date.js";
import type { Hlc } from "./hlc.js";
import type { ExchangeRates } from "./rates.js";
import { isCurrencyCode, isMoney, type Money } from "./money.js";

/** Bump when the stored shape changes; readers migrate older records. */
export const SCHEMA_VERSION = 1;

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ["active", "paused", "cancelled"];

/** The user-editable part of a subscription. */
export interface SubscriptionInput {
  name: string;
  status: SubscriptionStatus;
  price: Money;
  cycle: BillingCycle;
  /** First charge date; every later charge is derived from it and `cycle`. */
  anchorDate: LocalDate;
  /** Set for free trials: the trial ends here and the first charge is `anchorDate`. */
  trialEndsOn?: LocalDate | null;
  /** Last day of service after cancelling; no charges are expected after it. */
  endDate?: LocalDate | null;
  /** Days before a charge to remind; `null`/absent uses the settings default. */
  remindDaysBefore?: number[] | null;
  category?: string | null;
  tags?: string[];
  url?: string | null;
  cancelUrl?: string | null;
  /** Emoji, data URL or remote URL. */
  icon?: string | null;
  note?: string | null;
  /** Optional host-specific link, e.g. a SiYuan block ID. */
  noteRef?: string | null;
}

export interface RecordMeta {
  id: string;
  schemaVersion: number;
  /** ISO 8601 instant. */
  createdAt: string;
  updatedAt: Hlc;
  /** Tombstone: deleted records are kept so the deletion syncs. ISO 8601. */
  deletedAt?: string | null;
}

export type Subscription = SubscriptionInput & RecordMeta;

export type AppearanceMode = "auto" | "light" | "dark";

export interface Appearance {
  /** Theme ID understood by the UI (e.g. "host", "paper"); unknown IDs fall back to the default. */
  theme: string;
  /** "auto" follows the host app's light/dark mode. */
  mode: AppearanceMode;
  /** Accent colour override, `#rrggbb`, or `null` for the theme's own. */
  accent: string | null;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "host", mode: "auto", accent: null };

export interface Settings {
  defaultCurrency: string;
  /** Show totals converted into `defaultCurrency` using fetched exchange rates. */
  convertCurrency: boolean;
  appearance: Appearance;
  remindDaysBefore: number[];
  trialRemindDaysBefore: number[];
  /** Local time (`HH:mm`) at which same-day reminders become due. */
  notifyAt: string;
  updatedAt: Hlc | null;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultCurrency: "USD",
  convertCurrency: true,
  appearance: DEFAULT_APPEARANCE,
  remindDaysBefore: [3, 1],
  trialRemindDaysBefore: [3, 1],
  notifyAt: "09:00",
  updatedAt: null,
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MAX_TEXT = 2000;

function isReminderDays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 10 &&
    value.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 365)
  );
}

function normaliseReminderDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => b - a);
}

function optionalText(value: unknown, field: string, errors: string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_TEXT) {
    errors.push(`${field} must be a string of at most ${MAX_TEXT} characters`);
    return null;
  }
  return value;
}

function optionalDate(value: unknown, field: string, errors: string[]): LocalDate | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isLocalDate(value)) {
    errors.push(`${field} must be a YYYY-MM-DD date`);
    return null;
  }
  return value;
}

/** Validates untrusted input (e.g. from RPC or an import file). */
export function validateSubscriptionInput(input: unknown): ValidationResult<SubscriptionInput> {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) return { ok: false, errors: ["input must be an object"] };
  const raw = input as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 200) errors.push("name is required (max 200 characters)");

  const status = raw.status ?? "active";
  if (!SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) errors.push("status is invalid");

  if (!isMoney(raw.price)) errors.push("price must be { amount: non-negative integer minor units, currency: ISO 4217 }");
  if (!isBillingCycle(raw.cycle)) errors.push("cycle must be { unit: day|week|month|year, every: 1-1000 }");
  if (!isLocalDate(raw.anchorDate)) errors.push("anchorDate must be a YYYY-MM-DD date");

  const trialEndsOn = optionalDate(raw.trialEndsOn, "trialEndsOn", errors);
  const endDate = optionalDate(raw.endDate, "endDate", errors);
  if (trialEndsOn && isLocalDate(raw.anchorDate) && compareLocalDate(trialEndsOn, raw.anchorDate) > 0) {
    errors.push("trialEndsOn must not be after anchorDate");
  }

  let remindDaysBefore: number[] | null = null;
  if (raw.remindDaysBefore !== undefined && raw.remindDaysBefore !== null) {
    if (isReminderDays(raw.remindDaysBefore)) remindDaysBefore = normaliseReminderDays(raw.remindDaysBefore);
    else errors.push("remindDaysBefore must be up to 10 integers between 0 and 365");
  }

  let tags: string[] = [];
  if (raw.tags !== undefined) {
    if (Array.isArray(raw.tags) && raw.tags.length <= 50 && raw.tags.every((t) => typeof t === "string" && t.length <= 100)) {
      tags = [...new Set(raw.tags.map((t: string) => t.trim()).filter(Boolean))];
    } else {
      errors.push("tags must be up to 50 strings");
    }
  }

  const value: SubscriptionInput = {
    name,
    status: status as SubscriptionStatus,
    price: raw.price as Money,
    cycle: raw.cycle as BillingCycle,
    anchorDate: raw.anchorDate as LocalDate,
    trialEndsOn,
    endDate,
    remindDaysBefore,
    category: optionalText(raw.category, "category", errors),
    tags,
    url: optionalText(raw.url, "url", errors),
    cancelUrl: optionalText(raw.cancelUrl, "cancelUrl", errors),
    icon: optionalText(raw.icon, "icon", errors),
    note: optionalText(raw.note, "note", errors),
    noteRef: optionalText(raw.noteRef, "noteRef", errors),
  };

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Validates a partial settings update and merges it over `current`. */
export function validateSettingsPatch(patch: unknown, current: Settings): ValidationResult<Settings> {
  const errors: string[] = [];
  if (typeof patch !== "object" || patch === null) return { ok: false, errors: ["settings must be an object"] };
  const raw = patch as Record<string, unknown>;
  const next: Settings = { ...current };

  if (raw.defaultCurrency !== undefined) {
    if (isCurrencyCode(raw.defaultCurrency)) next.defaultCurrency = raw.defaultCurrency;
    else errors.push("defaultCurrency must be an ISO 4217 code");
  }
  if (raw.remindDaysBefore !== undefined) {
    if (isReminderDays(raw.remindDaysBefore)) next.remindDaysBefore = normaliseReminderDays(raw.remindDaysBefore);
    else errors.push("remindDaysBefore must be up to 10 integers between 0 and 365");
  }
  if (raw.trialRemindDaysBefore !== undefined) {
    if (isReminderDays(raw.trialRemindDaysBefore)) next.trialRemindDaysBefore = normaliseReminderDays(raw.trialRemindDaysBefore);
    else errors.push("trialRemindDaysBefore must be up to 10 integers between 0 and 365");
  }
  if (raw.notifyAt !== undefined) {
    if (isTimeOfDay(raw.notifyAt)) next.notifyAt = raw.notifyAt;
    else errors.push("notifyAt must be HH:mm");
  }
  if (raw.convertCurrency !== undefined) {
    if (typeof raw.convertCurrency === "boolean") next.convertCurrency = raw.convertCurrency;
    else errors.push("convertCurrency must be a boolean");
  }
  if (raw.appearance !== undefined) {
    const a = raw.appearance as Record<string, unknown> | null;
    if (typeof a !== "object" || a === null) {
      errors.push("appearance must be an object");
    } else {
      const appearance = { ...current.appearance };
      if (a.theme !== undefined) {
        if (typeof a.theme === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(a.theme)) appearance.theme = a.theme;
        else errors.push("appearance.theme must be a theme id");
      }
      if (a.mode !== undefined) {
        if (a.mode === "auto" || a.mode === "light" || a.mode === "dark") appearance.mode = a.mode;
        else errors.push("appearance.mode must be auto, light or dark");
      }
      if (a.accent !== undefined) {
        if (a.accent === null || (typeof a.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(a.accent))) appearance.accent = a.accent;
        else errors.push("appearance.accent must be #rrggbb or null");
      }
      next.appearance = appearance;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: next };
}

/** Whether a subscription is still expected to charge on `date`. */
export function isBillableOn(sub: Subscription, date: LocalDate): boolean {
  if (sub.deletedAt || sub.status !== "active") return false;
  if (sub.endDate && compareLocalDate(date, sub.endDate) > 0) return false;
  return true;
}

/** Everything a client needs to render: the live subscriptions and settings. */
export interface Snapshot {
  subscriptions: Subscription[];
  settings: Settings;
  /** Live (non-deleted) decisions. */
  decisions: Decision[];
  /** Cached exchange rates, if any have been fetched. */
  rates: ExchangeRates | null;
}

/**
 * The user's answer to "still using it?" for one specific charge.
 *
 * The ID is derived from (subscription, charge date), so every device writes
 * the same file for the same question and sync converges on the latest answer.
 */
export type DecisionChoice = "keep" | "cancel" | "snooze";

export const DECISION_CHOICES: readonly DecisionChoice[] = ["keep", "cancel", "snooze"];

export interface Decision {
  id: string;
  subscriptionId: string;
  chargeDate: LocalDate;
  choice: DecisionChoice;
  /** For `snooze`: ask again on this date (after `notifyAt`). */
  snoozeUntil: LocalDate | null;
  /** ISO 8601 instant. */
  decidedAt: string;
  updatedAt: Hlc;
  /** Tombstone, e.g. after an undo. ISO 8601. */
  deletedAt?: string | null;
  schemaVersion: number;
}

export function decisionId(subscriptionId: string, chargeDate: LocalDate): string {
  return `${subscriptionId}_${chargeDate}`;
}

/** The editable fields of a stored subscription, e.g. to re-submit it with changes. */
export function toSubscriptionInput(sub: Subscription): SubscriptionInput {
  const { id: _id, schemaVersion: _v, createdAt: _c, updatedAt: _u, deletedAt: _d, ...input } = sub;
  return input;
}
