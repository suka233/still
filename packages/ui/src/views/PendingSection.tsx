import { useI18n } from "../context.js";
import { formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { DecisionActions } from "./DecisionActions.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { usePending } from "./useDerived.js";

/** Charges the user was reminded about but hasn't answered, with inline answers. */
export function PendingSection({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const pending = usePending();
  if (pending.length === 0) return null;

  return (
    <section aria-label={t("pending")} className={cn("still:flex still:flex-col still:gap-1.5", className)}>
      <h3 className="still:flex still:items-center still:gap-1.5 still:text-xs still:font-medium still:text-muted-foreground">
        <span className="still:size-1.5 still:rounded-full still:bg-destructive still:animate-pulse" />
        {t("pending")}
        <span className="still:tabular-nums">{pending.length}</span>
      </h3>
      <ul className="still:flex still:flex-col still:gap-1.5">
        {pending.map(({ subscription: sub, chargeDate, daysLeft, kind }) => (
          <li
            key={`${sub.id}:${chargeDate}`}
            className="still-card still:flex still:flex-wrap still:items-center still:gap-x-3 still:gap-y-2 still:rounded-lg still:border still:border-border still:bg-card still:p-2.5 still:shadow-card still:animate-in still:fade-in-0 still:slide-in-from-top-1"
          >
            <div className="still:flex still:min-w-48 still:flex-1 still:items-center still:gap-2.5">
              <SubscriptionAvatar subscription={sub} />
              <div className="still:min-w-0 still:flex-1">
                <div className="still:truncate still:text-sm still:font-medium">
                  {kind === "trial-ending" ? t("reminder.trialTitle", { name: sub.name }) : t("reminder.title", { name: sub.name })}
                </div>
                <div className="still:text-xs still:text-muted-foreground still:tabular-nums">
                  {formatDaysLeft(daysLeft, t)} · {formatMoney(sub.price, locale)}
                </div>
              </div>
            </div>
            <DecisionActions subscription={sub} chargeDate={chargeDate} size="compact" className="still:ml-auto still:justify-end" />
          </li>
        ))}
      </ul>
    </section>
  );
}
