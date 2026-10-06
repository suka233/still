import { estimatePaid, monthlyEquivalent, type DueReminder } from "@still/core";
import { useRef, useState } from "react";
import { BRAND_ICON_PATHS } from "../catalog/icons.generated.js";
import { getService, serviceIdOfIcon } from "../catalog/services.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog.js";
import { useI18n, useStill } from "../context.js";
import { formatCycle, formatDate, formatDaysLeft, formatMoney, inlineWhen } from "../format.js";
import { pause } from "../motion.js";
import { readableOn } from "../theme.js";
import { DecisionActions, type Answer } from "./DecisionActions.js";
import { SubscriptionAvatar, accentOf } from "./SubscriptionAvatar.js";

/**
 * The "Still using it?" card. One superset markup; each theme lays it out
 * (centered sheet, paper slip, brand card, split panel). Closing without an
 * answer leaves the charge in "Waiting for you".
 *
 * Answering plays out on the card before it moves on: the store drops the
 * reminder as soon as the answer is saved, so the card being answered is held
 * here until its verdict (stamp, seal, tick…) and exit have played.
 */
const VERDICT_MS = 700;
const LEAVE_MS = 320;
const CODE: Record<Answer, string> = { keep: "RENEWED", cancel: "CANCELLED", later: "LATER" };
type Held = { reminder: DueReminder; answer: Answer; at: number; total: number; leaving: boolean };
export function ReminderDialog() {
  const { t, locale } = useI18n();
  const reminders = useStill((s) => s.reminders);
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  const dismiss = useStill((s) => s.dismissReminder);

  const [held, setHeldState] = useState<Held | null>(null);
  /* the async answer callbacks outlive the render they were created in */
  const heldRef = useRef<Held | null>(null);
  const setHeld = (next: Held | null | ((h: Held | null) => Held | null)) => {
    heldRef.current = typeof next === "function" ? next(heldRef.current) : next;
    setHeldState(heldRef.current);
  };
  /* cards that arrived while the dialog was already open slide in */
  const seen = useRef<{ last: string | null; next: Set<string> }>({ last: null, next: new Set() });

  const queue = reminders.filter((r) => subscriptions.some((s) => s.id === r.subscriptionId));
  const reminder = held?.reminder ?? queue[0];
  const sub = reminder && subscriptions.find((s) => s.id === reminder.subscriptionId);
  if (!reminder || !sub) {
    seen.current = { last: null, next: new Set() };
    return null;
  }
  if (seen.current.last && seen.current.last !== reminder.key) seen.current.next.add(reminder.key);
  seen.current.last = reminder.key;
  const total = held?.total ?? queue.length;

  const onAnswer = (answer: Answer | null) =>
    setHeld(answer ? { reminder, answer, at: performance.now(), total: queue.length, leaving: false } : null);
  const onDone = async () => {
    const current = heldRef.current;
    if (current) {
      /* let the verdict land, then send the card off */
      const shown = performance.now() - current.at;
      await pause(Math.max(0, VERDICT_MS - shown));
      setHeld((h) => h && { ...h, leaving: true });
      await pause(LEAVE_MS);
    }
    dismiss(reminder.key);
    setHeld(null);
  };

  const paid = estimatePaid(sub, today);
  const brand = accentOf(sub);
  const service = getService(serviceIdOfIcon(sub.icon));
  const logo = service?.icon ? BRAND_ICON_PATHS[service.icon] : undefined;
  const when = inlineWhen(formatDaysLeft(reminder.daysLeft, t), locale);
  const date = formatDate(reminder.chargeDate, locale);
  const trial = reminder.kind === "trial-ending";
  const yearly = Math.round(monthlyEquivalent(sub.price.amount, sub.cycle) * 12);
  const money = (amount: number) => formatMoney({ amount, currency: sub.price.currency }, locale);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        dismiss(reminder.key);
        setHeld(null);
      }}
    >
      <DialogContent bare onOpenAutoFocus={(e) => e.preventDefault()}>
        <article
          key={reminder.key}
          className="stl-decide"
          data-kind={reminder.kind}
          data-next={seen.current.next.has(reminder.key) || undefined}
          data-answer={held?.answer}
          data-phase={held ? (held.leaving ? "leave" : "answer") : undefined}
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
            <DecisionActions
              subscription={sub}
              chargeDate={reminder.chargeDate}
              closable
              answered={held?.answer}
              onAnswer={onAnswer}
              onDone={() => void onDone()}
            />
            {total > 1 && <p className="stl-queue">{t("reminder.counter", { index: 1, total })}</p>}
          </div>
          {held && (
            <div className="stl-verdict" data-answer={held.answer} aria-hidden>
              <b>{t(`decided.${held.answer}`)}</b>
              <small>{CODE[held.answer]}</small>
            </div>
          )}
        </article>
      </DialogContent>
    </Dialog>
  );
}
