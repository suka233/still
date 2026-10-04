import { addDays, chargesBetween, monthlyTotals, upcomingCharges } from "@still/core";
import { useMemo } from "react";
import { useStill } from "../context.js";

export function useUpcoming() {
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  return useMemo(() => upcomingCharges(subscriptions, today), [subscriptions, today]);
}

export function useTotals() {
  const subscriptions = useStill((s) => s.subscriptions);
  const today = useStill((s) => s.today);
  return useMemo(
    () => ({
      monthly: monthlyTotals(subscriptions, today),
      next30Days: chargesBetween(subscriptions, today, addDays(today, 30)),
    }),
    [subscriptions, today],
  );
}
