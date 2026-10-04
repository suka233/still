import { addDays, snoozeOptions, type LocalDate } from "@still/core";
import { BellOffIcon } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { useI18n, useStill } from "../context.js";
import { formatDate } from "../format.js";
import { cn } from "../lib/utils.js";

/**
 * "Ask me again …" menu around any trigger. Calls `onPick(date)` for a snooze,
 * or `onClose()` for "just close" (when given).
 */
export function SnoozeMenu({
  chargeDate,
  onPick,
  onClose,
  align = "center",
  children,
}: {
  chargeDate: LocalDate;
  onPick(until: LocalDate): void;
  onClose?(): void;
  align?: "start" | "center" | "end";
  children: ReactElement;
}) {
  const { t, locale } = useI18n();
  const today = useStill((s) => s.today);
  const [open, setOpen] = useState(false);
  const options = snoozeOptions(today, chargeDate);

  const label = (until: LocalDate, days: number) => {
    if (until === chargeDate) return t("snooze.dayOf", { date: formatDate(until, locale) });
    if (until === addDays(chargeDate, -1) && days > 1) return t("snooze.dayBefore", { date: formatDate(until, locale) });
    if (days === 1) return t("snooze.tomorrow");
    return t("snooze.days", { n: days });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="still:w-60">
        <div className="still:px-2 still:pt-1.5 still:pb-1 still:text-xs still:font-medium still:text-muted-foreground">{t("snooze.title")}</div>
        {options.map((o) => (
          <Item
            key={o.until}
            onClick={() => {
              setOpen(false);
              onPick(o.until);
            }}
          >
            {label(o.until, o.days)}
          </Item>
        ))}
        {onClose && (
          <Item
            muted
            onClick={() => {
              setOpen(false);
              onClose();
            }}
          >
            <BellOffIcon className="still:size-3.5" />
            {t("snooze.justClose")}
          </Item>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Item({ children, onClick, muted }: { children: React.ReactNode; onClick(): void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "still:flex still:w-full still:items-center still:gap-2 still:rounded-md still:px-2 still:py-1.5 still:text-left still:text-sm still:outline-none still:hover:bg-accent still:focus-visible:bg-accent",
        muted && "still:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
