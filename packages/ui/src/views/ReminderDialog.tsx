import { estimatePaid } from "@still/core";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog.js";
import { useI18n, useStill } from "../context.js";
import { formatDate, formatDaysLeft, formatMoney } from "../format.js";
import { DecisionActions } from "./DecisionActions.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";

/**
 * The "Still using it?" card. Shows the most urgent queued reminder; closing
 * it without answering leaves the charge in the dock's "Waiting for you" list.
 */
export function ReminderDialog() {
  const { t, locale } = useI18n();
  const reminders = useStill((s) => s.reminders);
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const dismiss = useStill((s) => s.dismissReminder);

  // Skip reminders whose subscription vanished (deleted elsewhere).
  const queue = reminders.filter((r) => subscriptions.some((s) => s.id === r.subscriptionId));
  const reminder = queue[0];
  const subscription = reminder && subscriptions.find((s) => s.id === reminder.subscriptionId);
  if (!reminder || !subscription) return null;

  const paid = estimatePaid(subscription, today);
  const meta = t("reminder.meta", {
    when: formatDaysLeft(reminder.daysLeft, t),
    date: formatDate(reminder.chargeDate, locale),
    price: formatMoney(subscription.price, locale),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss(reminder.key)}>
      <DialogContent className="still:max-w-sm still:gap-5" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="still:items-center still:gap-3 still:pr-0 still:pt-2 still:text-center">
          <SubscriptionAvatar subscription={subscription} className="still:size-14 still:text-2xl" />
          <DialogTitle className="still:text-lg">
            {reminder.kind === "trial-ending"
              ? t("reminder.trialTitle", { name: subscription.name })
              : t("reminder.title", { name: subscription.name })}
          </DialogTitle>
          <DialogDescription className="still:tabular-nums">{meta}</DialogDescription>
          {paid.count > 0 && (
            <p className="still:text-xs still:text-muted-foreground">
              {t("reminder.paid", { amount: formatMoney({ amount: paid.amount, currency: subscription.price.currency }, locale), count: paid.count })}
            </p>
          )}
          {subscription.note && (
            <p className="still:w-full still:rounded-md still:bg-muted still:px-3 still:py-2 still:text-left still:text-xs still:text-muted-foreground still:whitespace-pre-wrap">
              {subscription.note}
            </p>
          )}
        </DialogHeader>
        <DecisionActions subscription={subscription} chargeDate={reminder.chargeDate} onDone={() => dismiss(reminder.key)} />
        {queue.length > 1 && (
          <p className="still:-mt-2 still:text-center still:text-xs still:text-muted-foreground">
            {t("reminder.counter", { index: 1, total: queue.length })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
