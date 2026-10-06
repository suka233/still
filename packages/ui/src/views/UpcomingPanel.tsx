import { decisionId, monthlyEquivalent, type Subscription } from "@still/core";
import { ArrowUpRightIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { SERVICE_ICON_PREFIX, displayName, searchServices } from "../catalog/services.js";
import { useHost, useI18n, useStill } from "../context.js";
import { brandLine, formatCycle, formatDate, formatDaysLeft, formatMoney, localToDate } from "../format.js";
import { cn } from "../lib/utils.js";
import { useFirstEntrance, useLingering } from "../motion.js";
import { PendingSection } from "./PendingSection.js";
import { RollingTotals } from "./RollingTotals.js";
import type { PickResult } from "./ServicePicker.js";
import { StatusState } from "./StatusState.js";
import { SubscriptionAvatar, accentOf } from "./SubscriptionAvatar.js";
import { SubscriptionDialog } from "./SubscriptionDialog.js";
import { useDecisionIndex, useMonthOverview, useTotals, useUpcoming } from "./useDerived.js";
import { useFormatTotals } from "./useMoney.js";

type Bucket = "week" | "month" | "later";

function bucketOf(daysLeft: number): Bucket {
  return daysLeft <= 7 ? "week" : daysLeft <= 30 ? "month" : "later";
}

function urgencyOf(daysLeft: number): "hot" | "warm" | "calm" {
  return daysLeft <= 2 ? "hot" : daysLeft <= 7 ? "warm" : "calm";
}

/** The dock: what's left to pay this month, what needs a decision, what's coming. */
export function UpcomingPanel({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const host = useHost();
  const status = useStill((s) => s.status);
  const subscriptions = useStill((s) => s.subscriptions);
  const defaultCurrency = useStill((s) => s.settings.defaultCurrency);
  const today = useStill((s) => s.today);
  const upcoming = useUpcoming();
  const totals = useTotals();
  const month = useMonthOverview();
  const fmt = useFormatTotals();
  const decisions = useDecisionIndex();
  const entering = useFirstEntrance("dock");
  /* a cancelled charge stays a moment so its row can be struck out and folded away */
  const rows = useLingering(
    upcoming,
    (u) => u.subscription.id,
    (u) => subscriptions.find((s) => s.id === u.subscription.id)?.status === "cancelled",
  );
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [pick, setPick] = useState<PickResult | null>(null);
  const [open, setOpen] = useState(false);

  const openEditor = (sub: Subscription | null, preset: PickResult | null = null) => {
    setEditing(sub);
    setPick(preset);
    setOpen(true);
  };

  const monthTotal = useMemo(() => {
    const all: Record<string, number> = { ...month.paid };
    for (const [c, v] of Object.entries(month.remaining)) all[c] = (all[c] ?? 0) + v;
    return all;
  }, [month]);
  const progress = useMemo(() => {
    // Share already paid, compared within the dominant currency (good enough for a bar).
    const [currency] = Object.entries(monthTotal).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!currency) return 0;
    return Math.min(1, (month.paid[currency] ?? 0) / (monthTotal[currency] || 1));
  }, [month, monthTotal]);

  const groups = useMemo(() => {
    const out: { bucket: Bucket; items: typeof rows }[] = [];
    for (const r of rows) {
      const b = bucketOf(r.item.daysLeft);
      const g = out.find((x) => x.bucket === b) ?? (out.push({ bucket: b, items: [] }), out[out.length - 1]!);
      g.items.push(r);
    }
    return out;
  }, [rows]);
  let rowIndex = 0;

  const remaining = fmt(month.remaining, "");
  const monFmt = new Intl.DateTimeFormat(locale, { month: "short" });

  return (
    <div className={cn("still-panel stl-dock", className)} data-enter={entering || undefined}>
      {/* sheet/paper are layout-neutral (display: contents) unless a theme turns the dock into one slip */}
      <div className="stl-sheet">
      <div className="stl-paper">
      <header className="stl-head">
        <span className="stl-seal" aria-hidden>
          {t("appName").slice(0, 1)}
        </span>
        <div className="stl-brandline">{brandLine(t("appName"))}</div>
        <div className="stl-head-date">{t("dock.printed", { date: formatDate(today, locale, { year: "numeric", month: "short", day: "numeric", weekday: "short" }) })}</div>
        <div className="stl-head-main">
          <div className="stl-head-figure">
            <div className="stl-eyebrow">{remaining ? t("dock.remainingThisMonth") : t("monthlyAverage")}</div>
            <div className="stl-big still-amount">{remaining ? <RollingTotals totals={month.remaining} empty="" /> : fmt(totals.monthly)}</div>
          </div>
          <button type="button" className="stl-add" aria-label={t("addSubscription")} onClick={() => openEditor(null)} disabled={status !== "ready"}>
            <PlusIcon aria-hidden />
            <span>{t("add")}</span>
          </button>
        </div>
        {remaining && (
          <>
            <div className="stl-progress" style={{ "--p": `${Math.round(progress * 100)}%` } as React.CSSProperties}>
              <i />
            </div>
            <div className="stl-head-meta">
              <span>{t("dock.monthProgress", { total: fmt(monthTotal), paid: fmt(month.paid, formatMoney({ amount: 0, currency: defaultCurrency }, locale)) })}</span>
              <span className="stl-head-monthly">
                {t("monthlyAverage")} {fmt(totals.monthly)}
              </span>
            </div>
          </>
        )}
      </header>

      <StatusState />

      {status === "ready" && (
        <>
          <PendingSection />

          {rows.length === 0 ? (
            <div className="stl-empty">
              <div className="stl-empty-title">{subscriptions.length ? t("noSubscriptions") : t("welcome.title")}</div>
              <p>{t("emptyHint")}</p>
              <div className="stl-quick">
                {searchServices("", locale, 5).map((s) => (
                  <button key={s.id} type="button" onClick={() => openEditor(null, { kind: "service", service: s })}>
                    <SubscriptionAvatar subscription={{ icon: SERVICE_ICON_PREFIX + s.id, name: s.name }} className="stl-icon" />
                    <span>{displayName(s, locale)}</span>
                  </button>
                ))}
                <button type="button" onClick={() => openEditor(null)}>
                  <span className="still-avatar stl-icon stl-icon-more">
                    <MoreHorizontalIcon aria-hidden />
                  </span>
                  <span>{t("welcome.more")}</span>
                </button>
              </div>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.bucket} className="stl-group" data-bucket={g.bucket}>
                <h3 className="stl-group-label">{t(`group.${g.bucket}`)}</h3>
                <ul className="stl-list">
                  {g.items.map(({ item: { subscription: sub, chargeDate, daysLeft }, leaving }) => {
                    const trial = Boolean(sub.trialEndsOn && chargeDate === sub.anchorDate);
                    const date = localToDate(chargeDate);
                    const decision = decisions.get(decisionId(sub.id, chargeDate));
                    const mark = decision?.choice === "keep" ? "keep" : decision?.choice === "snooze" ? "snooze" : null;
                    const fresh = decision && Date.now() - Date.parse(decision.decidedAt) < 4000;
                    return (
                      <li key={sub.id} data-leaving={leaving || undefined} style={{ "--i": rowIndex++ } as React.CSSProperties}>
                        <button
                          type="button"
                          className="stl-row"
                          data-urgency={urgencyOf(daysLeft)}
                          style={{ "--brand": accentOf(sub) } as React.CSSProperties}
                          onClick={() => openEditor(sub)}
                          title={chargeDate}
                        >
                          <span className="stl-date">
                            <b>{date.getDate()}</b>
                            <span>{monFmt.format(date)}</span>
                          </span>
                          <span className="stl-dot" aria-hidden />
                          <span className="stl-card">
                            <SubscriptionAvatar subscription={sub} className="stl-icon" />
                            <span className="stl-main">
                              <span className="stl-name">
                                <span className="stl-name-text">{sub.name}</span>
                                {mark && (
                                  <span className="stl-mark" data-choice={mark} data-fresh={fresh || undefined}>
                                    {mark === "keep" ? t("decided.keep") : t("row.snoozed")}
                                  </span>
                                )}
                              </span>
                              <span className="stl-meta">
                                <span className="stl-meta-date">{formatDate(chargeDate, locale, { month: "short", day: "numeric" })} · </span>
                                {trial && (
                                  <>
                                    <span className="stl-meta-trial">{t("trial")}</span>
                                    <span className="stl-meta-sep"> · </span>
                                  </>
                                )}
                                {formatCycle(sub.cycle, t)}
                                <span className="stl-meta-when"> · {formatDaysLeft(daysLeft, t)}</span>
                              </span>
                            </span>
                            <span className="stl-leader" aria-hidden />
                            <span className="stl-price still-amount">
                              {formatMoney(sub.price, locale)}
                              <small className="stl-when">{formatDaysLeft(daysLeft, t)}</small>
                              {sub.cycle.unit !== "month" || sub.cycle.every !== 1 ? (
                                <small className="stl-permonth">
                                  ≈ {formatMoney({ amount: Math.round(monthlyEquivalent(sub.price.amount, sub.cycle)), currency: sub.price.currency }, locale)}
                                  {t("perMonth")}
                                </small>
                              ) : null}
                            </span>
                            <span className="stl-tminus">
                              {trial && <span className="stl-trial-mark">{t("trial")}</span>}T-{daysLeft}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {rows.length > 0 && (
            <footer className="stl-foot">
              <span>
                {t("monthlyAverage")} <RollingTotals totals={totals.monthly} />
              </span>
              {host.openManager ? (
                <button type="button" onClick={() => host.openManager!()}>
                  {t("viewAll")}
                  <ArrowUpRightIcon aria-hidden />
                </button>
              ) : (
                <span>{upcoming.length}</span>
              )}
            </footer>
          )}
        </>
      )}
      </div>
      </div>

      <SubscriptionDialog open={open} onOpenChange={setOpen} subscription={editing} initialPick={pick} />
    </div>
  );
}
