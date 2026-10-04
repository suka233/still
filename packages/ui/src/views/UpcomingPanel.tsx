import type { Subscription } from "@still/core";
import { ArrowUpRightIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { useHost, useI18n, useStill } from "../context.js";
import { formatCycle, formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { MoneyList } from "./MoneyList.js";
import { PendingSection } from "./PendingSection.js";
import { StatusState } from "./StatusState.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { SERVICE_ICON_PREFIX, displayName, searchServices } from "../catalog/services.js";
import type { PickResult } from "./ServicePicker.js";
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
  const host = useHost();
  const status = useStill((s) => s.status);
  const upcoming = useUpcoming();
  const totals = useTotals();
  const subscriptions = useStill((s) => s.subscriptions);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [pick, setPick] = useState<PickResult | null>(null);
  const [open, setOpen] = useState(false);

  const openEditor = (sub: Subscription | null, preset: PickResult | null = null) => {
    setEditing(sub);
    setPick(preset);
    setOpen(true);
  };

  return (
    <div className={cn("still-panel still:flex still:h-full still:flex-col still:gap-4 still:overflow-y-auto still:p-3", className)}>
      <header className="still:flex still:items-start still:justify-between still:gap-2">
        <div className="still:min-w-0">
          <div className="still:text-xs still:text-muted-foreground">{t("monthlyAverage")}</div>
          <div className="still:text-lg still:font-semibold still:leading-tight">
            <MoneyList totals={totals.monthly} suffix={t("perMonth")} />
          </div>
        </div>
        <Button size="sm" onClick={() => openEditor(null)} disabled={status !== "ready"}>
          <PlusIcon />
          {t("add")}
        </Button>
      </header>

      <StatusState />

      {status === "ready" && (
        <>
          <PendingSection />

          {upcoming.length === 0 ? (
            <div className="still:flex still:flex-1 still:flex-col still:items-center still:justify-center still:gap-3 still:px-2 still:text-center">
              <div className="still:font-display still:text-base still:font-semibold">{subscriptions.length ? t("noSubscriptions") : t("welcome.title")}</div>
              <p className="still:text-sm still:text-muted-foreground">{t("emptyHint")}</p>
              <div className="still:grid still:w-full still:grid-cols-3 still:gap-1">
                {searchServices("", locale, 5).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openEditor(null, { kind: "service", service: s })}
                    className="still:flex still:min-w-0 still:flex-col still:items-center still:gap-1 still:rounded-lg still:px-1 still:py-2 still:transition-colors still:hover:bg-accent"
                  >
                    <SubscriptionAvatar subscription={{ icon: SERVICE_ICON_PREFIX + s.id, name: s.name }} />
                    <span className="still:w-full still:truncate still:text-[11px]">{displayName(s, locale)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openEditor(null)}
                  className="still:flex still:min-w-0 still:flex-col still:items-center still:gap-1 still:rounded-lg still:px-1 still:py-2 still:text-muted-foreground still:transition-colors still:hover:bg-accent"
                >
                  <span className="still-avatar still:flex still:size-8 still:items-center still:justify-center still:border still:border-dashed still:border-border">
                    <MoreHorizontalIcon className="still:size-4" />
                  </span>
                  <span className="still:w-full still:truncate still:text-[11px]">{t("welcome.more")}</span>
                </button>
              </div>
            </div>
          ) : (
            <section className="still:flex still:flex-col still:gap-1">
              <div className="still:flex still:items-center still:justify-between">
                <h3 className="still:text-xs still:font-medium still:text-muted-foreground">{t("upcoming")}</h3>
                {host.openManager && (
                  <button
                    type="button"
                    onClick={() => host.openManager!()}
                    className="still:flex still:items-center still:gap-0.5 still:text-xs still:text-muted-foreground still:hover:text-foreground"
                  >
                    {t("viewAll")}
                    <ArrowUpRightIcon className="still:size-3" />
                  </button>
                )}
              </div>
              <ul className="still:-mx-1 still:flex still:flex-col">
                {upcoming.map(({ subscription: sub, chargeDate, daysLeft }) => (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(sub)}
                      title={chargeDate}
                      className="still:flex still:w-full still:items-center still:gap-2.5 still:rounded-md still:px-1 still:py-1.5 still:text-left still:transition-colors still:hover:bg-accent"
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
        </>
      )}

      <SubscriptionDialog open={open} onOpenChange={setOpen} subscription={editing} initialPick={pick} />
    </div>
  );
}
