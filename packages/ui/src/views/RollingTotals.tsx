import { useTweenedTotals } from "../motion.js";
import { useFormatTotals } from "./useMoney.js";

/** A total that rolls to its new value, e.g. when a cancellation takes a charge out of the month. */
export function RollingTotals({ totals, empty }: { totals: Record<string, number>; empty?: string }) {
  const fmt = useFormatTotals();
  return <>{fmt(useTweenedTotals(totals), empty)}</>;
}
