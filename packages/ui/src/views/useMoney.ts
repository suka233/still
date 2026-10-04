import { useMemo } from "react";
import { useI18n } from "../context.js";
import { formatMoney } from "../format.js";
import { useFold } from "./useDerived.js";

/**
 * Formats per-currency totals as one string: a single currency as is, several
 * as "≈ ¥620" when they can be converted, otherwise "¥128 + $24.99".
 */
export function useFormatTotals() {
  const { locale } = useI18n();
  const fold = useFold();
  return useMemo(
    () =>
      (totals: Record<string, number>, empty = "—"): string => {
        const entries = Object.entries(totals).filter(([, v]) => v > 0);
        if (entries.length === 0) return empty;
        const f = fold(Object.fromEntries(entries));
        if (f.exact && !f.partial) return formatMoney({ amount: f.amount, currency: f.currency }, locale);
        if (!f.exact && !f.partial) return `≈ ${formatMoney({ amount: f.amount, currency: f.currency }, locale)}`;
        return entries
          .sort((a, b) => b[1] - a[1])
          .map(([currency, amount]) => formatMoney({ amount, currency }, locale))
          .join(" + ");
      },
    [fold, locale],
  );
}
