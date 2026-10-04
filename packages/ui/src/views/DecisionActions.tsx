import type { LocalDate, Subscription } from "@still/core";
import { CheckIcon, Clock3Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../context.js";
import { cn } from "../lib/utils.js";
import { SnoozeMenu } from "./SnoozeMenu.js";
import { useDecide } from "./useDecide.js";

export interface DecisionActionsProps {
  subscription: Subscription;
  chargeDate: LocalDate;
  /** Called after any answer (or "just close"), e.g. to advance a queue. */
  onDone?(): void;
  /** Offer "just close" in the snooze menu. */
  closable?: boolean;
  className?: string;
}

/**
 * The three answers to "still using it?". Markup is shared by every theme;
 * each theme's CSS styles and orders `.stl-act` buttons (see themes.css).
 */
export function DecisionActions({ subscription, chargeDate, onDone, closable, className }: DecisionActionsProps) {
  const { t } = useI18n();
  const decide = useDecide();
  const [busy, setBusy] = useState(false);

  async function answer(choice: "keep" | "cancel" | "snooze", until?: LocalDate) {
    setBusy(true);
    const ok = await decide(subscription, chargeDate, choice, until);
    setBusy(false);
    if (ok) onDone?.();
  }

  return (
    <div className={cn("stl-actions", className)}>
      <button type="button" className="stl-act stl-keep" disabled={busy} onClick={() => void answer("keep")}>
        <CheckIcon aria-hidden />
        <span>{t("reminder.keep")}</span>
      </button>
      <button type="button" className="stl-act stl-cancel" disabled={busy} onClick={() => void answer("cancel")}>
        <XIcon aria-hidden />
        <span>{t("reminder.cancel")}</span>
      </button>
      <SnoozeMenu chargeDate={chargeDate} onPick={(until) => void answer("snooze", until)} onClose={closable ? onDone : undefined}>
        <button type="button" className="stl-act stl-later" disabled={busy}>
          <Clock3Icon aria-hidden />
          <span>{t("reminder.later")}</span>
        </button>
      </SnoozeMenu>
    </div>
  );
}
