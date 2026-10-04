import { addDays, snoozeOptions, type LocalDate, type Subscription } from "@still/core";
import { BellOffIcon, CheckIcon, Clock3Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { useI18n, useStill } from "../context.js";
import { formatDate } from "../format.js";
import { cn } from "../lib/utils.js";
import { useDecide } from "./useDecide.js";

export interface DecisionActionsProps {
  subscription: Subscription;
  chargeDate: LocalDate;
  /** `card` for the reminder dialog, `compact` for list rows. */
  size?: "card" | "compact";
  /** Called after any answer (or "just close"), e.g. to advance a queue. */
  onDone?(): void;
  className?: string;
}

/** The three answers to "still using it?": snooze · cancel · keep. */
export function DecisionActions({ subscription, chargeDate, size = "card", onDone, className }: DecisionActionsProps) {
  const { t, locale } = useI18n();
  const today = useStill((s) => s.today);
  const decide = useDecide();
  const [busy, setBusy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const options = snoozeOptions(today, chargeDate);
  const compact = size === "compact";

  async function answer(choice: "keep" | "cancel" | "snooze", until?: LocalDate) {
    setBusy(true);
    setSnoozeOpen(false);
    const ok = await decide(subscription, chargeDate, choice, until);
    setBusy(false);
    if (ok) onDone?.();
  }

  const snoozeLabel = (until: LocalDate, days: number) => {
    if (until === chargeDate) return t("snooze.dayOf", { date: formatDate(until, locale) });
    if (until === addDays(chargeDate, -1) && days > 1) return t("snooze.dayBefore", { date: formatDate(until, locale) });
    if (days === 1) return t("snooze.tomorrow");
    return t("snooze.days", { n: days });
  };

  return (
    <div className={cn(compact ? "still:flex still:gap-1" : "still:grid still:grid-cols-3 still:gap-2", className)}>
      <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size={compact ? "sm" : "default"} disabled={busy} className={compact ? "still:px-2" : undefined}>
            <Clock3Icon />
            {t("reminder.later")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={compact ? "end" : "start"} className="still:w-60">
          <div className="still:px-2 still:pt-1.5 still:pb-1 still:text-xs still:font-medium still:text-muted-foreground">{t("snooze.title")}</div>
          {options.map((o) => (
            <MenuItem key={o.until} onClick={() => void answer("snooze", o.until)}>
              {snoozeLabel(o.until, o.days)}
            </MenuItem>
          ))}
          {!compact && (
            <MenuItem
              muted
              onClick={() => {
                setSnoozeOpen(false);
                onDone?.();
              }}
            >
              <BellOffIcon className="still:size-3.5" />
              {t("snooze.justClose")}
            </MenuItem>
          )}
        </PopoverContent>
      </Popover>
      <Button
        variant={compact ? "ghost" : "destructive"}
        size={compact ? "sm" : "default"}
        disabled={busy}
        className={compact ? "still:px-2 still:text-destructive" : undefined}
        onClick={() => void answer("cancel")}
      >
        <XIcon />
        {t("reminder.cancel")}
      </Button>
      <Button size={compact ? "sm" : "default"} disabled={busy} className={compact ? "still:px-2" : undefined} onClick={() => void answer("keep")}>
        <CheckIcon />
        {t("reminder.keep")}
      </Button>
    </div>
  );
}

function MenuItem({ children, onClick, muted }: { children: React.ReactNode; onClick(): void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "still:flex still:w-full still:items-center still:gap-2 still:rounded-md still:px-2 still:py-1.5 still:text-left still:text-sm still:hover:bg-accent still:focus-visible:bg-accent still:outline-none",
        muted && "still:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
