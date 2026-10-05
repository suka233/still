import type { LocalDate, Subscription } from "@still/core";
import { CheckIcon, Clock3Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../context.js";
import { cn } from "../lib/utils.js";
import { SnoozeMenu } from "./SnoozeMenu.js";
import { useDecide } from "./useDecide.js";

export type Answer = "keep" | "cancel" | "later";

export interface DecisionActionsProps {
  subscription: Subscription;
  chargeDate: LocalDate;
  /** Called after any answer (or "just close"), e.g. to advance a queue. */
  onDone?(): void;
  /** Called the moment an answer is picked (before it's saved), and with null if saving failed. */
  onAnswer?(answer: Answer | null): void;
  /** The answer being played out: that button shows it, the others step back. */
  answered?: Answer | null;
  /** Offer "just close" in the snooze menu. */
  closable?: boolean;
  className?: string;
}

/**
 * The three answers to "still using it?". Markup is shared by every theme;
 * each theme's CSS styles and orders `.stl-act` buttons (see themes.css), and
 * motion.css plays the picked one.
 */
export function DecisionActions({ subscription, chargeDate, onDone, onAnswer, answered, closable, className }: DecisionActionsProps) {
  const { t } = useI18n();
  const decide = useDecide();
  const [busy, setBusy] = useState(false);

  async function answer(choice: "keep" | "cancel" | "snooze", until?: LocalDate) {
    setBusy(true);
    onAnswer?.(choice === "snooze" ? "later" : choice);
    const ok = await decide(subscription, chargeDate, choice, until);
    setBusy(false);
    if (ok) onDone?.();
    else onAnswer?.(null);
  }

  const state = (a: Answer) => (answered === a ? { "data-picked": "" } : answered ? { "data-dimmed": "" } : {});
  const locked = busy || Boolean(answered);

  return (
    <div className={cn("stl-actions", className)}>
      <button type="button" className="stl-act stl-keep" disabled={locked} onClick={() => void answer("keep")} {...state("keep")}>
        <CheckIcon aria-hidden />
        <span>{answered === "keep" ? t("decided.keep") : t("reminder.keep")}</span>
      </button>
      <button type="button" className="stl-act stl-cancel" disabled={locked} onClick={() => void answer("cancel")} {...state("cancel")}>
        <XIcon aria-hidden />
        <span>{answered === "cancel" ? t("decided.cancel") : t("reminder.cancel")}</span>
      </button>
      <SnoozeMenu chargeDate={chargeDate} onPick={(until) => void answer("snooze", until)} onClose={closable ? onDone : undefined}>
        <button type="button" className="stl-act stl-later" disabled={locked} {...state("later")}>
          <Clock3Icon aria-hidden />
          <span>{answered === "later" ? t("decided.later") : t("reminder.later")}</span>
        </button>
      </SnoozeMenu>
    </div>
  );
}
