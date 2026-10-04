import { addDays } from "@still/core";
import { Button } from "../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.js";
import { useHost, useI18n, useStill } from "../context.js";
import { formatDate, formatDaysLeft, formatMoney } from "../format.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";

/**
 * The "Still using it?" decision card. Shows the most urgent pending reminder;
 * every choice dismisses it, and "cancel" also records the cancellation.
 */
export function ReminderDialog() {
  const { t, locale } = useI18n();
  const host = useHost();
  const reminder = useStill((s) => s.reminders[0]);
  const subscription = useStill((s) => s.subscriptions.find((x) => x.id === reminder?.subscriptionId));
  const dismiss = useStill((s) => s.dismissReminder);
  const update = useStill((s) => s.update);

  if (!reminder || !subscription) return null;

  const when = `${formatDaysLeft(reminder.daysLeft, t)} (${formatDate(reminder.chargeDate, locale)})`;
  const price = formatMoney(subscription.price, locale);

  async function cancelIt() {
    if (!reminder || !subscription) return;
    const { id, schemaVersion: _v, createdAt: _c, updatedAt: _u, deletedAt: _d, ...input } = subscription;
    // Service normally runs until the day before the charge that won't happen.
    await update(id, { ...input, status: "cancelled", endDate: addDays(reminder.chargeDate, -1) });
    if (subscription.cancelUrl) host.openUrl(subscription.cancelUrl);
    host.toast?.(t("reminder.cancelHint"));
    dismiss(reminder.key);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss(reminder.key)}>
      <DialogContent className="still:max-w-sm">
        <DialogHeader className="still:flex-row still:items-center still:gap-3">
          <SubscriptionAvatar subscription={subscription} className="still:size-10 still:text-base" />
          <div className="still:grid still:gap-1">
            <DialogTitle>
              {reminder.kind === "trial-ending"
                ? t("reminder.trialTitle", { name: subscription.name })
                : t("reminder.title", { name: subscription.name })}
            </DialogTitle>
            <DialogDescription>{t("reminder.body", { when, price })}</DialogDescription>
          </div>
        </DialogHeader>
        {subscription.note && <p className="still:text-sm still:text-muted-foreground still:whitespace-pre-wrap">{subscription.note}</p>}
        <DialogFooter className="still:grid still:grid-cols-3">
          <Button variant="outline" onClick={() => dismiss(reminder.key)}>{t("reminder.later")}</Button>
          <Button variant="destructive" onClick={() => void cancelIt()}>{t("reminder.cancel")}</Button>
          <Button onClick={() => dismiss(reminder.key)}>{t("reminder.keep")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
