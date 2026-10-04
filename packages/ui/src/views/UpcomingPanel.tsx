import type { Subscription } from "@still/core";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { useI18n, useStill } from "../context.js";
import { formatCycle, formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { MoneyList } from "./MoneyList.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { SubscriptionDialog } from "./SubscriptionDialog.js";
import { useTotals, useUpcoming } from "./useDerived.js";

function urgency(daysLeft: number): "destructive" | "warning" | "secondary" {
  if (daysLeft <= 1) return "destructive";
  if (daysLeft <= 7) return "warning";
  return "secondary";
}

/** Compact list of upcoming charges, sized for a sidebar / dock. */
export function UpcomingPanel({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const status = useStill((s) => s.status);
  const error = useStill((s) => s.error);
  const upcoming = useUpcoming();
  const totals = useTotals();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [open, setOpen] = useState(false);

  const openEditor = (sub: Subscription | null) => {
    setEditing(sub);
    setOpen(true);
  };

  return (
    <div className={cn("still:flex still:h-full still:flex-col still:gap-3 still:p-3", className)}>
      <header className="still:flex still:items-start still:justify-between still:gap-2">
        <div className="still:min-w-0">
          <div className="still:text-xs still:text-muted-foreground">{t("monthlyAverage")}</div>
          <div className="still:text-lg still:font-semibold">
            <MoneyList totals={totals.monthly} suffix={t("perMonth")} />
          </div>
        </div>
        <Button size="sm" onClick={() => openEditor(null)}>
          <PlusIcon />
          {t("add")}
        </Button>
      </header>

      {status === "error" && (
        <p role="alert" className="still:rounded-md still:bg-destructive/10 still:px-3 still:py-2 still:text-sm still:text-destructive">
          {t("error.kernel")}
          <span className="still:mt-1 still:block still:text-xs still:opacity-70">{error}</span>
        </p>
      )}

      {status === "ready" && upcoming.length === 0 && (
        <div className="still:flex still:flex-1 still:flex-col still:items-center still:justify-center still:gap-2 still:px-4 still:text-center">
          <div className="still:font-medium">{t("noSubscriptions")}</div>
          <p className="still:text-sm still:text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="still:flex still:min-h-0 still:flex-col still:gap-1">
          <h3 className="still:text-xs still:font-medium still:text-muted-foreground">{t("upcoming")}</h3>
          <ul className="still:-mx-1 still:flex still:flex-col still:overflow-y-auto">
            {upcoming.map(({ subscription: sub, chargeDate, daysLeft }) => (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={() => openEditor(sub)}
                  title={chargeDate}
                  className="still:flex still:w-full still:items-center still:gap-2.5 still:rounded-md still:px-1 still:py-1.5 still:text-left still:hover:bg-accent"
                >
                  <SubscriptionAvatar subscription={sub} />
                  <span className="still:min-w-0 still:flex-1">
                    <span className="still:block still:truncate still:text-sm still:font-medium">{sub.name}</span>
                    <span className="still:block still:truncate still:text-xs still:text-muted-foreground">
                      {formatMoney(sub.price, locale)} · {formatCycle(sub.cycle, t)}
                    </span>
                  </span>
                  <span className="still:flex still:flex-col still:items-end still:gap-0.5">
                    <Badge variant={urgency(daysLeft)}>{formatDaysLeft(daysLeft, t)}</Badge>
                    {sub.trialEndsOn && chargeDate === sub.anchorDate && (
                      <span className="still:text-[10px] still:text-muted-foreground">{t("trial")}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SubscriptionDialog open={open} onOpenChange={setOpen} subscription={editing} />
    </div>
  );
}
