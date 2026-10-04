import { diffDays, estimatePaid, monthlyEquivalent, nextOccurrence, type Subscription } from "@still/core";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { categoryLabel } from "../../catalog/category.js";
import { Badge } from "../../components/ui/badge.js";
import { Card } from "../../components/ui/card.js";
import { NativeSelect } from "../../components/ui/native-select.js";
import { Segmented } from "../../components/ui/segmented.js";
import { useI18n, useStill } from "../../context.js";
import { formatCycle, formatDate, formatDaysLeft, formatMoney } from "../../format.js";
import { SubscriptionAvatar } from "../SubscriptionAvatar.js";
import { useMonthlyCostIn } from "../useDerived.js";

type Filter = "all" | "active" | "trial" | "paused" | "cancelled";
type Sort = "next" | "price" | "name";

export function SubscriptionList({ onEdit }: { onEdit(sub: Subscription): void }) {
  const { t, locale } = useI18n();
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const monthlyIn = useMonthlyCostIn();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("next");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isTrial = (s: Subscription) => Boolean(s.trialEndsOn && s.status === "active" && s.anchorDate >= today);
    const filtered = subscriptions.filter((s) => {
      if (q && !`${s.name} ${s.category ?? ""} ${categoryLabel(s.category, t)} ${s.note ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "trial") return isTrial(s);
      return filter === "all" || s.status === filter;
    });
    const withMeta = filtered.map((s) => ({
      sub: s,
      next: s.status === "active" && (!s.endDate || s.endDate >= today) ? nextOccurrence(s.anchorDate, s.cycle, today) : null,
      monthly: monthlyIn(s.price.amount, s.price.currency, s.cycle),
      trial: isTrial(s),
    }));
    const rank = { active: 0, paused: 1, cancelled: 2 } as const;
    return withMeta.sort((a, b) => {
      if (sort === "name") return a.sub.name.localeCompare(b.sub.name, locale);
      if (sort === "price") return b.monthly.amount - a.monthly.amount;
      return rank[a.sub.status] - rank[b.sub.status] || (a.next ?? "9999").localeCompare(b.next ?? "9999");
    });
  }, [subscriptions, query, filter, sort, today, t, locale, monthlyIn]);

  return (
    <div className="still:flex still:flex-col still:gap-3">
      <div className="still:flex still:flex-wrap still:items-center still:gap-2">
        <div className="still:relative still:min-w-48 still:flex-1">
          <SearchIcon className="still:pointer-events-none still:absolute still:top-1/2 still:left-2.5 still:size-4 still:-translate-y-1/2 still:text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("manager.search")}
            aria-label={t("manager.search")}
            className="still:h-8 still:w-full still:rounded-md still:border still:border-input still:bg-transparent still:pr-2 still:pl-8 still:text-sm still:outline-none still:placeholder:text-muted-foreground still:focus-visible:border-ring"
          />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={(v) => setFilter(v)}
          options={(["all", "active", "trial", "paused", "cancelled"] as const).map((v) => ({ value: v as Filter, label: t(`manager.filter.${v}`) }))}
        />
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="still:h-7 still:w-auto still:text-xs" aria-label="sort">
          <option value="next">{t("manager.sort.next")}</option>
          <option value="price">{t("manager.sort.price")}</option>
          <option value="name">{t("manager.sort.name")}</option>
        </NativeSelect>
      </div>

      <Card className="still-card still:shadow-card still:p-1.5">
        {rows.length === 0 ? (
          <p className="still:py-10 still:text-center still:text-sm still:text-muted-foreground">{subscriptions.length ? t("manager.empty") : t("emptyHint")}</p>
        ) : (
          <ul className="still:flex still:flex-col">
            {rows.map(({ sub, next, monthly, trial }) => {
              const paid = estimatePaid(sub, today);
              const daysLeft = next ? diffDays(today, next) : null;
              return (
                <li key={sub.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(sub)}
                    className="still:flex still:w-full still:items-center still:gap-3 still:rounded-md still:px-2.5 still:py-2.5 still:text-left still:transition-colors still:hover:bg-accent"
                  >
                    <SubscriptionAvatar subscription={sub} className="still:size-9" />
                    <span className="still:min-w-0 still:flex-1">
                      <span className="still:flex still:flex-wrap still:items-center still:gap-1.5">
                        <span className="still:truncate still:font-medium">{sub.name}</span>
                        {trial && <Badge variant="warning">{t("trial")}</Badge>}
                        {sub.status !== "active" && <Badge variant="outline">{t(`status.${sub.status}`)}</Badge>}
                        {sub.category && <Badge variant="secondary">{categoryLabel(sub.category, t)}</Badge>}
                      </span>
                      <span className="still:block still:truncate still:text-xs still:text-muted-foreground">
                        {formatCycle(sub.cycle, t)}
                        {next && daysLeft !== null && ` · ${formatDaysLeft(daysLeft, t)} · ${formatDate(next, locale)}`}
                        {!next && sub.endDate && ` · ${t("manager.endsOn", { date: formatDate(sub.endDate, locale) })}`}
                        {paid.count > 0 && ` · ${t("manager.paidSoFar", { amount: formatMoney({ amount: paid.amount, currency: sub.price.currency }, locale) })}`}
                      </span>
                    </span>
                    <span className="still:flex still:flex-col still:items-end still:gap-0.5">
                      <span className="still-amount still:text-sm still:font-semibold">{formatMoney(sub.price, locale)}</span>
                      {sub.cycle.unit !== "month" || sub.cycle.every !== 1 ? (
                        <span className="still:text-[11px] still:text-muted-foreground still:tabular-nums">
                          ≈ {formatMoney({ amount: Math.round(monthlyEquivalent(sub.price.amount, sub.cycle)), currency: sub.price.currency }, locale)}
                          {t("perMonth")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
