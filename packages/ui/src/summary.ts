import { convertTotals, monthlyTotals, upcomingCharges, type ExchangeRates, type LocalDate, type Settings, type Subscription } from "@still/core";
import { formatCycle, formatDate, formatDaysLeft, formatMoney } from "./format.js";
import type { Translate } from "./i18n/index.js";

export interface SummaryState {
  subscriptions: Subscription[];
  today: LocalDate;
  settings: Settings;
  rates: ExchangeRates | null;
}

export interface SummaryOptions {
  /** Only charges within this many days. */
  days?: number;
  /** At most this many rows. */
  limit?: number;
}

/**
 * A Markdown table of upcoming charges plus the monthly average, for notes:
 * SiYuan's `/续了么` slash command, Obsidian's `still` code block and command.
 */
export function summaryMarkdown(state: SummaryState, t: Translate, locale: string, options: SummaryOptions = {}): string {
  const { subscriptions, today, settings, rates } = state;
  let rows = upcomingCharges(subscriptions, today);
  if (options.days !== undefined) rows = rows.filter((r) => r.daysLeft <= options.days!);
  if (options.limit !== undefined) rows = rows.slice(0, options.limit);
  if (!rows.length) return t("slash.empty");
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `| ${t("slash.colName")} | ${t("slash.colPrice")} | ${t("slash.colCycle")} | ${t("slash.colNext")} |`,
    "| --- | ---: | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${cell(r.subscription.name)} | ${formatMoney(r.subscription.price, locale)} | ${formatCycle(r.subscription.cycle, t)} | ${formatDate(r.chargeDate, locale)} · ${formatDaysLeft(r.daysLeft, t)} |`,
    ),
  ];
  const totals = monthlyTotals(subscriptions, today);
  const converted = settings.convertCurrency && rates ? convertTotals(totals, settings.defaultCurrency, rates) : null;
  const amount =
    converted && !Object.keys(converted.unconverted).length && Object.keys(totals).length > 1
      ? `≈ ${formatMoney({ amount: converted.amount, currency: settings.defaultCurrency }, locale)}`
      : Object.entries(totals)
          .map(([currency, v]) => formatMoney({ amount: v, currency }, locale))
          .join(" + ");
  return `${lines.join("\n")}\n\n${t("slash.total", { amount })}`;
}
