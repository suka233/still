import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n, useStill } from "../context.js";
import { formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { reducedMotion, useSettled } from "../motion.js";
import { DecisionActions } from "./DecisionActions.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";
import { usePending } from "./useDerived.js";

const DONE_MS = 2200;

/**
 * Charges the user was reminded about but hasn't answered. The head opens the
 * decision card for all of them; the item list (shown by some themes) answers
 * inline. The count flips as answers come in, and the last one leaves a brief
 * "all decided" before the section folds away.
 */
export function PendingSection({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const pending = usePending();
  const review = useStill((s) => s.reviewPending);
  const settled = useSettled();
  const [done, setDone] = useState(false);
  const previous = useRef(pending.length);

  useEffect(() => {
    const before = previous.current;
    previous.current = pending.length;
    if (before > 0 && pending.length === 0 && !reducedMotion()) {
      setDone(true);
      const timer = window.setTimeout(() => setDone(false), DONE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [pending.length]);

  if (pending.length === 0) {
    if (!done) return null;
    return (
      <section aria-label={t("pending")} className={cn("stl-pending", className)} data-done>
        <div className="stl-pending-head" role="status">
          <span className="stl-pending-count" data-flip>
            <CheckIcon aria-hidden />
          </span>
          <span className="stl-pending-text">
            <b>
              <span className="stl-pending-full">{t("pending.allDone")}</span>
              <span className="stl-pending-short">{t("pending.allDone")}</span>
            </b>
          </span>
        </div>
      </section>
    );
  }

  const names = pending.map((p) => p.subscription.name).join(locale.startsWith("zh") ? "、" : ", ");
  const flip = settled || undefined;

  return (
    <section aria-label={t("pending")} className={cn("stl-pending", className)}>
      <button type="button" className="stl-pending-head" onClick={() => review(pending)}>
        <span className="stl-stack">
          {pending.slice(0, 3).map((p) => (
            <SubscriptionAvatar key={p.subscription.id} subscription={p.subscription} className="stl-icon" />
          ))}
        </span>
        <span key={pending.length} className="stl-pending-count" data-flip={flip}>
          {pending.length}
        </span>
        <span className="stl-pending-text">
          <b>
            <span key={pending.length} className="stl-pending-full" data-flip={flip}>
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
