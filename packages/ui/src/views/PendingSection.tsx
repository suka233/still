import { ChevronRightIcon } from "lucide-react";
import { useI18n, useStill } from "../context.js";
import { formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { DecisionActions } from "./DecisionActions.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { usePending } from "./useDerived.js";

/**
 * Charges the user was reminded about but hasn't answered. The head opens the
 * decision card for all of them; the item list (shown by some themes) answers
 * inline.
 */
export function PendingSection({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const pending = usePending();
  const review = useStill((s) => s.reviewPending);
  if (pending.length === 0) return null;
  const names = pending.map((p) => p.subscription.name).join("、");

  return (
    <section aria-label={t("pending")} className={cn("stl-pending", className)}>
      <button type="button" className="stl-pending-head" onClick={() => review(pending)}>
        <span className="stl-stack">
          {pending.slice(0, 3).map((p) => (
            <SubscriptionAvatar key={p.subscription.id} subscription={p.subscription} className="stl-icon" />
          ))}
        </span>
        <span className="stl-pending-count">{pending.length}</span>
        <span className="stl-pending-text">
          <b>
            <span className="stl-pending-full">
              {pending.length === 1 ? t("pending.bannerOne", { name: pending[0]!.subscription.name }) : t("pending.banner", { n: pending.length })}
            </span>
            <span className="stl-pending-short">{t(pending.length === 1 ? "pending.tailOne" : "pending.tail")}</span>
          </b>
          <small>{names}</small>
        </span>
        <span className="stl-pending-go">
          <span>{t("pending.review")}</span>
          <ChevronRightIcon aria-hidden />
        </span>
      </button>
      <ul className="stl-pending-items">
        {pending.map(({ subscription: sub, chargeDate, daysLeft }) => (
          <li key={`${sub.id}:${chargeDate}`} className="stl-pending-item">
            <SubscriptionAvatar subscription={sub} className="stl-icon" />
            <span className="stl-pending-name">
              {sub.name}
              <small>
                {formatDaysLeft(daysLeft, t)} · {formatMoney(sub.price, locale)}
              </small>
            </span>
            <DecisionActions subscription={sub} chargeDate={chargeDate} className="stl-actions-mini" />
          </li>
        ))}
      </ul>
    </section>
  );
}
