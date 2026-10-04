import type { Subscription } from "@still/core";
import type { ReactNode } from "react";
import { Badge } from "../components/ui/badge.js";
import { useI18n } from "../context.js";
import { formatCycle, formatDaysLeft, formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";

/** Text colour for "how soon": today/tomorrow stands out, this week is warm, later is quiet. */
export function urgencyClass(daysLeft: number): string {
  if (daysLeft <= 1) return "still:text-destructive still:font-medium";
  if (daysLeft <= 7) return "still:text-[color-mix(in_oklab,var(--warning-foreground)_80%,var(--foreground))]";
  return "still:text-muted-foreground";
}

export interface SubscriptionRowProps {
  subscription: Subscription;
  daysLeft?: number | null;
  trial?: boolean;
  /** Extra line under the meta, e.g. paid-so-far. */
  detail?: ReactNode;
  /** Right-aligned secondary text under the price. */
  aside?: ReactNode;
  onClick?(): void;
  dense?: boolean;
  className?: string;
}

/** The shared list row: brand tile, name, cycle · when, price. */
export function SubscriptionRow({ subscription: sub, daysLeft, trial, detail, aside, onClick, dense, className }: SubscriptionRowProps) {
  const { t, locale } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "still:group still:flex still:w-full still:items-center still:gap-3 still:rounded-xl still:px-2 still:text-left still:transition-colors still:hover:bg-foreground/[0.045] still:focus-visible:bg-foreground/[0.045] still:outline-none",
        dense ? "still:py-1.5" : "still:py-2",
        className,
      )}
    >
      <SubscriptionAvatar subscription={sub} className={dense ? "still:size-8" : "still:size-9"} />
      <span className="still:min-w-0 still:flex-1">
        <span className="still:flex still:items-center still:gap-1.5">
          <span className="still:truncate still:text-[13.5px] still:font-medium still:leading-5">{sub.name}</span>
          {trial && <Badge variant="soft-warning">{t("trial")}</Badge>}
          {sub.status !== "active" && <Badge variant="soft">{t(`status.${sub.status}`)}</Badge>}
        </span>
        <span className="still:block still:truncate still:text-xs still:leading-4 still:text-muted-foreground">
          {formatCycle(sub.cycle, t)}
          {daysLeft !== undefined && daysLeft !== null && (
            <>
              {" · "}
              <span className={urgencyClass(daysLeft)}>{formatDaysLeft(daysLeft, t)}</span>
            </>
          )}
          {detail}
        </span>
      </span>
      <span className="still:flex still:shrink-0 still:flex-col still:items-end">
        <span className="still-amount still:text-[13.5px] still:font-semibold still:leading-5">{formatMoney(sub.price, locale)}</span>
        {aside && <span className="still:text-[11px] still:leading-4 still:text-muted-foreground still:tabular-nums">{aside}</span>}
      </span>
    </button>
  );
}
