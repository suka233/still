/**
 * Calendar-date arithmetic on `YYYY-MM-DD` strings.
 *
 * Billing dates are civil dates in the user's own calendar, not instants, so
 * they never pass through `Date` (whose behaviour depends on the host time
 * zone) or `Intl` (absent in the goja runtime that hosts SiYuan kernel plugins).
 */

/** A civil date formatted as `YYYY-MM-DD`. */
export type LocalDate = string;

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(value: LocalDate): DateParts {
  if (!isLocalDate(value)) throw new RangeError(`Invalid local date: ${String(value)}`);
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatLocalDate({ year, month, day }: DateParts): LocalDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Days since 1970-01-01 (Howard Hinnant's days_from_civil). */
export function toEpochDay(value: LocalDate): number {
  const { year, month, day } = parseLocalDate(value);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(epochDay: number): LocalDate {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return formatLocalDate({ year, month, day });
}

export function addDays(value: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(value) + days);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/**
 * Adds calendar months, clamping to the last day of a shorter month
 * (Jan 31 + 1 month = Feb 28/29).
 */
export function addMonths(value: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(value);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  return formatLocalDate({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, daysInMonth(nextYear, nextMonth)),
  });
}

/** Months from `from` to `to`, counting only the year/month fields. */
export function diffCalendarMonths(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  // Zero-padded ISO dates sort lexicographically.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The civil date of `date` in the host's local time zone. */
export function localDateOf(date: Date): LocalDate {
  return formatLocalDate({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/** Minutes since local midnight of `date` in the host's local time zone. */
export function localMinutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && TIME_OF_DAY_RE.test(value);
}

/** Parses `HH:mm` into minutes since midnight. */
export function parseTimeOfDay(value: string): number {
  const m = TIME_OF_DAY_RE.exec(value);
  if (!m) throw new RangeError(`Invalid time of day: ${value}`);
  return Number(m[1]) * 60 + Number(m[2]);
}
