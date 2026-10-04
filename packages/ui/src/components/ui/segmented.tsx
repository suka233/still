import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** A row of mutually exclusive chips (radio semantics). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange(value: T): void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  size?: "default" | "sm";
  "aria-label"?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("still:inline-flex still:flex-wrap still:gap-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "still:inline-flex still:items-center still:gap-1.5 still:rounded-md still:border still:font-medium still:transition-colors still:cursor-pointer still:outline-none still:focus-visible:ring-2 still:focus-visible:ring-ring/50 still:disabled:opacity-50 still:disabled:cursor-not-allowed",
            size === "sm" ? "still:h-7 still:px-2.5 still:text-xs" : "still:h-8 still:px-3 still:text-sm",
            o.value === value
              ? "still:border-primary still:bg-primary still:text-primary-foreground"
              : "still:border-border still:bg-background still:text-foreground still:hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select chips (checkbox semantics). */
export function ChipToggleGroup<T extends string | number>({
  values,
  onChange,
  options,
  className,
}: {
  values: readonly T[];
  onChange(values: T[]): void;
  options: readonly { value: T; label: ReactNode }[];
  className?: string;
}) {
  const set = new Set(values);
  return (
    <div className={cn("still:inline-flex still:flex-wrap still:gap-1", className)}>
      {options.map((o) => {
        const on = set.has(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn(
              "still:inline-flex still:h-7 still:items-center still:rounded-full still:border still:px-2.5 still:text-xs still:font-medium still:transition-colors still:cursor-pointer still:outline-none still:focus-visible:ring-2 still:focus-visible:ring-ring/50",
              on
                ? "still:border-primary still:bg-primary/10 still:text-primary"
                : "still:border-border still:text-muted-foreground still:hover:bg-accent still:hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
