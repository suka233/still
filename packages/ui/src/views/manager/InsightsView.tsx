import { isBillableOn, type Subscription } from "@still/core";
import { useMemo } from "react";
import { categoryLabel } from "../../catalog/category.js";
import { Card, CardHeader, CardTitle } from "../../components/ui/card.js";
import { useI18n, useStill } from "../../context.js";
import { formatMoney } from "../../format.js";
import { SubscriptionAvatar } from "../SubscriptionAvatar.js";
import { useMonthlyCostIn } from "../useDerived.js";

const BAR_COLORS = ["var(--primary)", "#f59e0b", "#10b981", "#ec4899", "#6366f1", "#06b6d4", "#84cc16", "#f97316", "#a855f7", "#64748b"];

/** Where the money goes: by category and the biggest single costs. */
export function InsightsView({ onEdit }: { onEdit(sub: Subscription): void }) {
  const { t, locale } = useI18n();
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const monthlyIn = useMonthlyCostIn();

  const { groups, top, currencies } = useMemo(() => {
    const live = subscriptions.filter((s) => isBillableOn(s, today));
    const costs = live.map((s) => ({ sub: s, cost: monthlyIn(s.price.amount, s.price.currency, s.cycle) }));
    const currencies = [...new Set(costs.map((c) => c.cost.currency))];
    // Group within the most common currency; others are listed separately.
    const main = currencies.sort((a, b) => costs.filter((c) => c.cost.currency === b).length - costs.filter((c) => c.cost.currency === a).length)[0];
    const byCategory = new Map<string, number>();
    for (const c of costs) {
      if (c.cost.currency !== main) continue;
      const key = c.sub.category ?? "";
      byCategory.set(key, (byCategory.get(key) ?? 0) + c.cost.amount);
    }
    const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
    const groups = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0, currency: main! }));
    const top = costs.filter((c) => c.cost.currency === main).sort((a, b) => b.cost.amount - a.cost.amount).slice(0, 5);
    return { groups, top, currencies };
  }, [subscriptions, today, monthlyIn]);

  if (groups.length === 0) {
    return <p className="still:py-10 still:text-center still:text-sm still:text-muted-foreground">{t("emptyHint")}</p>;
  }

  return (
    <div className="still:grid still:gap-3 still:@3xl:grid-cols-2">
      <Card className="still:p-4">
        <CardHeader>
          <CardTitle className="still:font-display">{t("insights.byCategory")}</CardTitle>
        </CardHeader>
        <div className="still:flex still:h-3 still:overflow-hidden still:rounded-full still:bg-muted">
          {groups.map((g, i) => (
            <div key={g.category} style={{ width: `${g.share * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} title={categoryLabel(g.category, t)} />
          ))}
        </div>
        <ul className="still:flex still:flex-col still:gap-1.5">
          {groups.map((g, i) => (
            <li key={g.category} className="still:flex still:items-center still:gap-2 still:text-sm">
              <span className="still:size-2.5 still:shrink-0 still:rounded-sm" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
              <span className="still:min-w-0 still:flex-1 still:truncate">{categoryLabel(g.category, t)}</span>
              <span className="still:text-xs still:text-muted-foreground still:tabular-nums">{t("insights.share", { percent: Math.round(g.share * 100) })}</span>
              <span className="still-amount still:w-24 still:text-right">{formatMoney({ amount: g.amount, currency: g.currency }, locale)}</span>
            </li>
          ))}
        </ul>
        {currencies.length > 1 && <p className="still:text-xs still:text-muted-foreground">{t("insights.needsRates")}</p>}
      </Card>

      <Card className="still:p-4">
        <CardHeader>
          <CardTitle className="still:font-display">{t("insights.topSpend")}</CardTitle>
        </CardHeader>
        <ol className="still:-mx-1 still:flex still:flex-col">
          {top.map(({ sub, cost }, i) => (
            <li key={sub.id}>
              <button type="button" onClick={() => onEdit(sub)} className="still:flex still:w-full still:items-center still:gap-2.5 still:rounded-md still:px-1 still:py-1.5 still:text-left still:hover:bg-accent">
                <span className="still:w-4 still:text-center still:text-xs still:font-semibold still:text-muted-foreground">{i + 1}</span>
                <SubscriptionAvatar subscription={sub} />
                <span className="still:min-w-0 still:flex-1 still:truncate still:text-sm still:font-medium">{sub.name}</span>
                <span className="still-amount still:text-sm">
                  {formatMoney(cost, locale)}
                  <span className="still:text-xs still:text-muted-foreground">{t("perMonth")}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
