import { diffDays, type DecisionChoice, type LocalDate, type Subscription } from "@still/core";
import { useCallback } from "react";
import { toast } from "../components/ui/toaster.js";
import { useHost, useI18n, useStill } from "../context.js";
import { formatDate, formatDaysLeft } from "../format.js";
import { parseRpcErrors } from "./errors.js";

/**
 * Answers "still using it?" with the matching feedback: a toast for every
 * choice, Undo for anything that changed data, and a shortcut to the
 * provider's cancellation page after "cancel".
 */
export function useDecide() {
  const { t, locale } = useI18n();
  const host = useHost();
  const decide = useStill((s) => s.decide);
  const undo = useStill((s) => s.undo);
  const today = useStill((s) => s.today);

  return useCallback(
    async (sub: Subscription, chargeDate: LocalDate, choice: DecisionChoice, snoozeUntil?: LocalDate) => {
      try {
        const token = await decide(sub.id, chargeDate, choice, snoozeUntil);
        const undoAction = {
          label: t("toast.undo"),
          onClick: () => {
            undo(token)
              .then(() => toast(t("toast.undone")))
              .catch((e: unknown) => toast.error(parseRpcErrors(e).join("\n")));
          },
        };
        if (choice === "keep") {
          toast(t("toast.kept", { name: sub.name }), { cancel: undoAction });
        } else if (choice === "snooze" && snoozeUntil) {
          const days = diffDays(today, snoozeUntil);
          const when = `${formatDaysLeft(days, t)} (${formatDate(snoozeUntil, locale)})`;
          toast(t("toast.snoozed", { when }), { cancel: undoAction });
        } else if (choice === "cancel") {
          toast(t("toast.cancelled", { name: sub.name }), {
            description: t("toast.cancelledHint"),
            duration: 10_000,
            cancel: undoAction,
            action: sub.cancelUrl ? { label: t("toast.openCancel"), onClick: () => host.openUrl(sub.cancelUrl!) } : undefined,
          });
        }
        return true;
      } catch (e) {
        toast.error(parseRpcErrors(e).join("\n"));
        return false;
      }
    },
    [decide, undo, t, locale, host, today],
  );
}
