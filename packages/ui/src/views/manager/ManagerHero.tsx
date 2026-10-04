import { addDays, chargesInRange } from "@still/core";
import { useMemo } from "react";
import { useI18n, useStill } from "../../context.js";
import { formatDate, localToDate } from "../../format.js";
import { accentOf } from "../SubscriptionAvatar.js";
import { useFold, useForecast, useTotals, useUpcoming } from "../useDerived.js";
import { useFormatTotals } from "../useMoney.js";

/**
 * Totals, the six-month forecast and a 30-day strip. Every theme gets the same
 * markup; themes.css decides the presentation (big number + bars, ledger,
 * glass, metric row + strip).
 */
export function ManagerHero() {
  const { t, locale } = useI18n();
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const totals = useTotals();
  const upcoming = useUpcoming();
  const forecast = useForecast(6);
  const fold = useFold();
  const fmt = useFormatTotals();

  const bars = forecast.map((f) => ({ ...f, folded: fold(f.totals) }));
  const max = Math.max(1, ...bars.map((b) => b.folded.amount));
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const strip = useMemo(() => {
    const charges = chargesInRange(subscriptions, today, addDays(today, 29));
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i);
      return { date, items: charges.filter((c) => c.date === date).map((c) => c.subscription) };
    });
  }, [subscriptions, today]);

  return (
    <section className="stl-hero">
      <div className="stl-hero-main">
        <div className="stl-eyebrow">
          <span className="stl-eyebrow-brand">MONTHLY · </span>
          {t("hero.monthly")}
        </div>
        <div className="stl-big still-amount">{fmt(totals.monthly)}</div>
        <dl className="stl-kv">
          <div data-k="monthly">
            <dt>{t("hero.monthly")}</dt>
            <dd className="still-amount">{fmt(totals.monthly)}</dd>
          </div>
          <div data-k="yearly">
            <dt>{t("yearlyEstimate")}</dt>
            <dd className="still-amount">{fmt(totals.yearly)}</dd>
          </div>
          <div data-k="next30">
            <dt>{t("dueIn30Days")}</dt>
            <dd className="still-amount">{fmt(totals.next30Days, "0")}</dd>
          </div>
          <div data-k="saved">
            <dt>{t("stats.saved")}</dt>
            <dd className="still-amount">{fmt(totals.saved.totals, "0")}</dd>
          </div>
          <div data-k="active">
            <dt>{t("activeCount")}</dt>
            <dd>{upcoming.length}</dd>
          </div>
        </dl>
      </div>

      <div className="stl-forecast">
        <div className="stl-eyebrow">{t("hero.forecast")}</div>
        <div className="stl-bars">
          {bars.map((b, i) => (
            <div key={b.month} className="stl-bar" data-current={i === 0 || undefined} style={{ "--v": b.folded.amount / max } as React.CSSProperties}>
              <i />
              <span className="stl-bar-label">{monthFmt.format(localToDate(`${b.month}-01`))}</span>
              <b className="stl-bar-value still-amount">{fmt(b.totals, "0")}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="stl-strip">
        <div className="stl-strip-label">
          <span>{t("hero.next30")}</span>
          <span>
            {formatDate(today, locale, { month: "short", day: "numeric" })} → {formatDate(addDays(today, 29), locale, { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="stl-days">
          {strip.map((d, i) => (
            <i
              key={d.date}
              data-today={i === 0 || undefined}
              data-charges={d.items.length || undefined}
              title={d.items.map((s) => s.name).join(", ") || d.date}
              style={d.items[0] ? ({ "--brand": accentOf(d.items[0]) } as React.CSSProperties) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
