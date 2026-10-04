import { addDays, chargesBetween, indexDecisions, monthlyTotals, pendingDecisions, upcomingCharges } from "@still/core";
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

export function useDecisionIndex() {
  const decisions = useStill((s) => s.decisions);
  return useMemo(() => indexDecisions(decisions), [decisions]);
}

/** Charges the user was asked about and hasn't answered yet. */
export function usePending() {
  const subscriptions = useStill((s) => s.subscriptions);
  const settings = useStill((s) => s.settings);
  const clock = useStill((s) => s.clock);
  const index = useDecisionIndex();
  return useMemo(() => pendingDecisions(subscriptions, settings, clock, index), [subscriptions, settings, clock, index]);
}
