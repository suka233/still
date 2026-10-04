import { nextOccurrence, type Subscription } from "@still/core";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.js";
import { useI18n, useStill } from "../context.js";
import { formatCycle, formatDate, formatMoney } from "../format.js";
import { MoneyList } from "./MoneyList.js";
import { SettingsCard } from "./SettingsCard.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { SubscriptionDialog } from "./SubscriptionDialog.js";
import { useTotals, useUpcoming } from "./useDerived.js";

const STATUS_ORDER = { active: 0, paused: 1, cancelled: 2 } as const;

/** Full-page view: totals, every subscription, and settings. */
export function ManagerView() {
  const { t, locale } = useI18n();
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const totals = useTotals();
  const upcoming = useUpcoming();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [open, setOpen] = useState(false);

  const yearly = useMemo(
    () => Object.fromEntries(Object.entries(totals.monthly).map(([c, v]) => [c, v * 12])),
    [totals.monthly],
  );
  const sorted = useMemo(
    () => [...subscriptions].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.name < b.name ? -1 : 1)),
    [subscriptions],
  );

  const openEditor = (sub: Subscription | null) => {
    setEditing(sub);
    setOpen(true);
  };

  return (
    <div className="still:mx-auto still:flex still:w-full still:max-w-4xl still:flex-col still:gap-4 still:p-4 still:md:p-6">
      <header className="still:flex still:items-center still:justify-between still:gap-3">
        <div>
          <h1 className="still:text-xl still:font-semibold">{t("appName")}</h1>
          <p className="still:text-sm still:text-muted-foreground">{t("tagline")}</p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <PlusIcon />
          {t("addSubscription")}
        </Button>
      </header>

      <div className="still:grid still:grid-cols-2 still:gap-3 still:md:grid-cols-4">
        <Stat label={t("monthlyAverage")}><MoneyList totals={totals.monthly} /></Stat>
        <Stat label={t("yearlyEstimate")}><MoneyList totals={yearly} /></Stat>
        <Stat label={t("dueIn30Days")}><MoneyList totals={totals.next30Days} /></Stat>
        <Stat label={t("activeCount")}>{upcoming.length}</Stat>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("allSubscriptions")}</CardTitle>
          {sorted.length === 0 && <CardDescription>{t("emptyHint")}</CardDescription>}
        </CardHeader>
        {sorted.length > 0 && (
          <CardContent>
            <ul className="still:divide-y still:divide-border">
              {sorted.map((sub) => {
                const next = sub.status === "active" ? nextOccurrence(sub.anchorDate, sub.cycle, today) : null;
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(sub)}
                      className="still:flex still:w-full still:items-center still:gap-3 still:px-1 still:py-2 still:text-left still:hover:bg-accent still:rounded-md"
                    >
                      <SubscriptionAvatar subscription={sub} />
                      <span className="still:min-w-0 still:flex-1">
                        <span className="still:flex still:items-center still:gap-2">
                          <span className="still:truncate still:font-medium">{sub.name}</span>
                          {sub.status !== "active" && <Badge variant="outline">{t(`status.${sub.status}`)}</Badge>}
                          {sub.category && <Badge variant="secondary">{sub.category}</Badge>}
                        </span>
                        <span className="still:block still:text-xs still:text-muted-foreground">
                          {formatCycle(sub.cycle, t)}
                          {next && ` · ${formatDate(next, locale)}`}
                        </span>
                      </span>
                      <span className="still:text-sm still:font-medium still:tabular-nums">{formatMoney(sub.price, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        )}
      </Card>

      <SettingsCard />
      <SubscriptionDialog open={open} onOpenChange={setOpen} subscription={editing} />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="still:gap-1">
      <div className="still:text-xs still:text-muted-foreground">{label}</div>
      <div className="still:text-base still:font-semibold">{children}</div>
    </Card>
  );
}
