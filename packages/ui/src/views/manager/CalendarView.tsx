import { addMonths, chargesInRange, daysInMonth, formatLocalDate, parseLocalDate, type LocalDate, type Subscription } from "@still/core";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Card } from "../../components/ui/card.js";
import { useI18n, useStill } from "../../context.js";
import { formatDate, formatMoney } from "../../format.js";
import { cn } from "../../lib/utils.js";
import { MoneyList } from "../MoneyList.js";
import { SubscriptionAvatar } from "../SubscriptionAvatar.js";

/** Sunday-first weeks for US/Canada/Japan…, Monday-first elsewhere. */
function weekStartsOnSunday(locale: string): boolean {
  return /^(en-(US|CA)|ja|ko|zh-TW|he|pt-BR)/.test(locale) || locale === "en";
}

function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day).getDay();
}

/** Month grid of expected charges; click a day to see what's charged. */
export function CalendarView({ onEdit }: { onEdit(sub: Subscription): void }) {
  const { t, locale } = useI18n();
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const [month, setMonth] = useState(() => `${today.slice(0, 7)}-01`);
  // Start on the next day something is charged, so the side panel isn't empty.
  const [selected, setSelected] = useState<LocalDate>(() => {
    const next = chargesInRange(subscriptions, today, addMonths(today, 2))[0];
    return next?.date ?? today;
  });

  const { year, month: m } = parseLocalDate(month);
  const last = formatLocalDate({ year, month: m, day: daysInMonth(year, m) });
  const charges = useMemo(() => chargesInRange(subscriptions, month, last), [subscriptions, month, last]);
  const byDay = useMemo(() => {
    const map = new Map<LocalDate, typeof charges>();
    for (const c of charges) map.set(c.date, [...(map.get(c.date) ?? []), c]);
    return map;
  }, [charges]);
  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const c of charges) totals[c.subscription.price.currency] = (totals[c.subscription.price.currency] ?? 0) + c.subscription.price.amount;
    return totals;
  }, [charges]);

  const sundayFirst = weekStartsOnSunday(locale);
  const lead = (weekdayOf(month) - (sundayFirst ? 0 : 1) + 7) % 7;
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth(year, m) }, (_, i) => formatLocalDate({ year, month: m, day: i + 1 })),
  ];
  while (cells.length % 7) cells.push(null);

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2024, 0, (sundayFirst ? 7 : 8) + i)));
  const title = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(year, m - 1, 1));
  const selectedCharges = byDay.get(selected) ?? [];

  return (
    <div className="still:grid still:gap-3 still:@3xl:grid-cols-[1fr_17rem]">
      <Card className="still:p-3">
        <div className="still:flex still:items-center still:justify-between still:gap-2">
          <div>
            <div className="still:font-display still:text-base still:font-semibold">{title}</div>
            <div className="still:text-xs still:text-muted-foreground">
              {t("calendar.monthTotal", { amount: "" })}
              <MoneyList totals={monthTotals} className="still:text-xs" detailClassName="still:hidden" />
            </div>
          </div>
          <div className="still:flex still:items-center still:gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t("calendar.prev")} onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(`${today.slice(0, 7)}-01`);
                setSelected(today);
              }}
              disabled={month === `${today.slice(0, 7)}-01` && selected === today}
            >
              {t("calendar.today")}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("calendar.next")} onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <div className="still:grid still:grid-cols-7 still:gap-1 still:text-center">
          {weekdays.map((w) => (
            <div key={w} className="still:py-1 still:text-[11px] still:font-medium still:text-muted-foreground">{w}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />;
            const dayCharges = byDay.get(date) ?? [];
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                className={cn(
                  "still:flex still:aspect-square still:min-h-12 still:flex-col still:items-center still:gap-1 still:rounded-md still:border still:p-1 still:text-xs still:transition-colors",
                  isSelected ? "still:border-primary still:bg-primary/5" : "still:border-transparent still:hover:bg-accent",
                  date < today && "still:opacity-60",
                )}
              >
                <span
                  className={cn(
                    "still:flex still:size-5 still:items-center still:justify-center still:rounded-full still:tabular-nums",
                    isToday && "still:bg-primary still:font-semibold still:text-primary-foreground",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                {dayCharges.length > 0 && (
                  <span className="still:flex still:-space-x-1.5">
                    {dayCharges.slice(0, 3).map((c) => (
                      <SubscriptionAvatar key={c.subscription.id} subscription={c.subscription} className="still:size-4 still:text-[8px] still:ring-1 still:ring-background" />
                    ))}
                    {dayCharges.length > 3 && <span className="still:pl-2 still:text-[10px] still:text-muted-foreground">+{dayCharges.length - 3}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="still:p-3">
        <div className="still:font-medium">
          {formatDate(selected, locale, { month: "long", day: "numeric", weekday: "short" })}
        </div>
        {selectedCharges.length === 0 ? (
          <p className="still:text-sm still:text-muted-foreground">{t("calendar.nothing")}</p>
        ) : (
          <ul className="still:-mx-1 still:flex still:flex-col">
            {selectedCharges.map(({ subscription: sub }) => (
              <li key={sub.id}>
                <button type="button" onClick={() => onEdit(sub)} className="still:flex still:w-full still:items-center still:gap-2.5 still:rounded-md still:px-1 still:py-1.5 still:text-left still:hover:bg-accent">
                  <SubscriptionAvatar subscription={sub} />
                  <span className="still:min-w-0 still:flex-1 still:truncate still:text-sm still:font-medium">{sub.name}</span>
                  <span className="still-amount still:text-sm">{formatMoney(sub.price, locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
