import { estimatePaid, monthlyEquivalent } from "@still/core";
import { BRAND_ICON_PATHS } from "../catalog/icons.generated.js";
import { getService, serviceIdOfIcon } from "../catalog/services.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog.js";
import { useI18n, useStill } from "../context.js";
import { formatCycle, formatDate, formatDaysLeft, formatMoney } from "../format.js";
import { readableOn } from "../theme.js";
import { DecisionActions } from "./DecisionActions.js";
import { SubscriptionAvatar, accentOf } from "./SubscriptionAvatar.js";

/**
 * The "Still using it?" card. One superset markup; each theme lays it out
 * (centered sheet, paper slip, brand card, split panel). Closing without an
 * answer leaves the charge in "Waiting for you".
 */
export function ReminderDialog() {
  const { t, locale } = useI18n();
  const reminders = useStill((s) => s.reminders);
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const dismiss = useStill((s) => s.dismissReminder);

  const queue = reminders.filter((r) => subscriptions.some((s) => s.id === r.subscriptionId));
  const reminder = queue[0];
  const sub = reminder && subscriptions.find((s) => s.id === reminder.subscriptionId);
  if (!reminder || !sub) return null;

  const paid = estimatePaid(sub, today);
  const brand = accentOf(sub);
  const service = getService(serviceIdOfIcon(sub.icon));
  const logo = service?.icon ? BRAND_ICON_PATHS[service.icon] : undefined;
  const when = formatDaysLeft(reminder.daysLeft, t);
  const date = formatDate(reminder.chargeDate, locale);
  const trial = reminder.kind === "trial-ending";
  const yearly = Math.round(monthlyEquivalent(sub.price.amount, sub.cycle) * 12);
  const money = (amount: number) => formatMoney({ amount, currency: sub.price.currency }, locale);

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss(reminder.key)}>
      <DialogContent bare onOpenAutoFocus={(e) => e.preventDefault()}>
        <article
          className="stl-decide"
          data-kind={reminder.kind}
          style={{ "--brand": brand, "--brand-ink": /^#/.test(brand) ? readableOn(brand) : "#fff" } as React.CSSProperties}
        >
          <div className="stl-band">
            <SubscriptionAvatar subscription={sub} className="stl-icon" />
            <div className="stl-band-when">
              <b>{reminder.daysLeft <= 0 ? t("today") : reminder.daysLeft === 1 ? t("tomorrow") : reminder.daysLeft}</b>
              {reminder.daysLeft > 1 && <span>{t("unit.day")}</span>}
            </div>
            {logo && (
              <svg className="stl-watermark" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={logo} />
              </svg>
            )}
          </div>
          <div className="stl-body">
            <div className="stl-eyebrow">
              <span className="stl-eyebrow-brand">RENEWAL NOTICE · </span>
              {t("reminder.eyebrow")}
            </div>
            <DialogTitle className="stl-title">{trial ? t("reminder.trialQuestion", { name: sub.name }) : t("reminder.question", { name: sub.name })}</DialogTitle>
            <DialogDescription className="stl-sub">{trial ? t("reminder.trialEnds", { when, date }) : t("reminder.renewsOn", { when, date })}</DialogDescription>
            <div className="stl-amount still-amount">
              {formatMoney(sub.price, locale)}
              <small> / {formatCycle(sub.cycle, t)}</small>
            </div>
            <dl className="stl-facts">
              <div data-k="cycle">
                <dt>{t("fact.cycle")}</dt>
                <dd>{formatCycle(sub.cycle, t)}</dd>
              </div>
              {paid.count > 0 && (
                <div data-k="paid">
                  <dt>{t("fact.paid")}</dt>
                  <dd>{money(paid.amount)}</dd>
                </div>
              )}
              {paid.count > 0 && (
                <div data-k="count">
                  <dt>{t("fact.count")}</dt>
                  <dd>{paid.count}</dd>
                </div>
              )}
              <div data-k="yearly">
                <dt>{t("fact.yearly")}</dt>
                <dd>≈ {money(yearly)}</dd>
              </div>
              {sub.note && (
                <div data-k="note">
                  <dt>{t("fact.note")}</dt>
                  <dd>{sub.note}</dd>
                </div>
              )}
              <div data-k="total">
                <dt>{trial ? t("reminder.firstCharge") : t("reminder.thisCharge")}</dt>
                <dd>{formatMoney(sub.price, locale)}</dd>
              </div>
            </dl>
            <DecisionActions subscription={sub} chargeDate={reminder.chargeDate} closable onDone={() => dismiss(reminder.key)} />
            {queue.length > 1 && <p className="stl-queue">{t("reminder.counter", { index: 1, total: queue.length })}</p>}
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}
