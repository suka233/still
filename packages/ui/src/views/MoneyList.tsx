import { useI18n } from "../context.js";
import { formatMoney } from "../format.js";
import { cn } from "../lib/utils.js";
import { useConverted } from "./useDerived.js";

/**
 * Totals, combined into the default currency when conversion is available
 * ("≈ ¥620"), otherwise listed per currency ("¥128 · $24.99").
 */
export function MoneyList({
  totals,
  suffix,
  empty = "—",
  className,
  detailClassName,
}: {
  totals: Record<string, number>;
  suffix?: string;
  empty?: string;
  className?: string;
  /** Class for the per-currency breakdown shown under a converted total. */
  detailClassName?: string;
}) {
  const { locale } = useI18n();
  const converted = useConverted(totals);
  const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const unit = suffix && <span className="still:text-[0.7em] still:font-normal still:text-muted-foreground">{suffix}</span>;

  if (entries.length === 0) return <span className={cn("still-amount", className)}>{empty}</span>;

  if (converted) {
    const extra = Object.entries(converted.unconverted);
    return (
      <span className="still:inline-flex still:flex-col">
        <span className={cn("still-amount", className)}>
          ≈ {formatMoney({ amount: converted.amount, currency: converted.currency }, locale)}
          {unit}
          {extra.map(([currency, amount]) => (
            <span key={currency}> + {formatMoney({ currency, amount }, locale)}</span>
          ))}
        </span>
        <span className={cn("still:text-xs still:font-normal still:text-muted-foreground still:tabular-nums", detailClassName)}>
          {entries.map(([currency, amount]) => formatMoney({ currency, amount }, locale)).join(" · ")}
        </span>
      </span>
    );
  }

  return (
    <span className={cn("still-amount still:inline-flex still:flex-wrap still:gap-x-2", className)}>
      {entries.map(([currency, amount]) => (
        <span key={currency}>
          {formatMoney({ currency, amount }, locale)}
          {unit}
        </span>
      ))}
    </span>
  );
}
