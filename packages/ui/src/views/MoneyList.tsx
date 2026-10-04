import { useI18n } from "../context.js";
import { formatMoney } from "../format.js";

/** Per-currency totals, e.g. "¥128 · $24.99". Currencies aren't converted. */
export function MoneyList({ totals, suffix, empty = "—" }: { totals: Record<string, number>; suffix?: string; empty?: string }) {
  const { locale } = useI18n();
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span>{empty}</span>;
  return (
    <span className="still:inline-flex still:flex-wrap still:gap-x-2">
      {entries.map(([currency, amount]) => (
        <span key={currency} className="still:tabular-nums">
          {formatMoney({ currency, amount }, locale)}
          {suffix && <span className="still:text-muted-foreground still:text-xs">{suffix}</span>}
        </span>
      ))}
    </span>
  );
}
