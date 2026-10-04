import type { Appearance } from "@still/core";
import { CheckIcon } from "lucide-react";
import { Segmented } from "../../components/ui/segmented.js";
import { useHostInfo, useI18n } from "../../context.js";
import { cn } from "../../lib/utils.js";
import { ACCENTS, THEMES, applyAppearance, resolveAppearance, type ThemeId } from "../../theme.js";

/**
 * Theme cards that preview themselves: each card is its own `.still-root`
 * scope with that theme applied, so what you see is what you get.
 */
export function ThemePicker({ appearance, onChange }: { appearance: Appearance; onChange(patch: Partial<Appearance>): void }) {
  const { t } = useI18n();
  const { scopeClassName, hostDark } = useHostInfo();
  const current = resolveAppearance(appearance, hostDark);

  return (
    <div className="still:grid still:gap-4">
      <div className="still:grid still:grid-cols-2 still:gap-2 still:@xl:grid-cols-3">
        {THEMES.map((theme) => {
          const selected = current.theme === theme.id;
          const preview = resolveAppearance({ ...appearance, theme: theme.id }, hostDark);
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ theme: theme.id })}
              className={cn(
                "still:group still:relative still:flex still:flex-col still:overflow-hidden still:rounded-lg still:border-2 still:text-left still:transition-all still:cursor-pointer",
                selected ? "still:border-primary" : "still:border-transparent still:hover:border-border",
              )}
            >
              <div
                ref={(el) => {
                  if (el) applyAppearance(el, preview);
                }}
                className={cn("still-root still-panel", scopeClassName, "still:pointer-events-none still:flex still:flex-col still:gap-1.5 still:p-2.5")}
              >
                <PreviewRow />
                <PreviewRow short />
              </div>
              <div className="still:flex still:items-center still:justify-between still:gap-1 still:border-t still:border-border still:bg-card still:px-2.5 still:py-2">
                <span className="still:min-w-0">
                  <span className="still:block still:truncate still:text-sm still:font-medium">{t(`theme.${theme.id}` as const)}</span>
                  <span className="still:block still:truncate still:text-[11px] still:text-muted-foreground">{t(`theme.${theme.id}.desc` as const)}</span>
                </span>
                {selected && <CheckIcon className="still:size-4 still:shrink-0 still:text-primary" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="still:grid still:gap-1.5">
        <div className="still:text-xs still:font-medium still:text-muted-foreground">{t("settings.mode")}</div>
        <Segmented
          size="sm"
          value={appearance.mode}
          onChange={(mode) => onChange({ mode })}
          options={(["auto", "light", "dark"] as const).map((v) => ({ value: v, label: t(`settings.mode.${v}`), disabled: current.theme === "host" && v !== "auto" }))}
        />
        {current.theme === "host" && <p className="still:text-xs still:text-muted-foreground">{t("settings.modeHostHint")}</p>}
      </div>

      <div className="still:grid still:gap-1.5">
        <div className="still:text-xs still:font-medium still:text-muted-foreground">{t("settings.accent")}</div>
        <div role="radiogroup" aria-label={t("settings.accent")} className="still:flex still:flex-wrap still:gap-2">
          {ACCENTS.map((accent) => {
            const on = appearance.accent === accent;
            return (
              <button
                key={accent ?? "default"}
                type="button"
                role="radio"
                aria-checked={on}
                title={accent ?? t("settings.accent.default")}
                onClick={() => onChange({ accent })}
                className={cn(
                  "still:flex still:size-7 still:items-center still:justify-center still:rounded-full still:border still:transition-transform still:cursor-pointer still:hover:scale-110",
                  on ? "still:ring-2 still:ring-ring still:ring-offset-2 still:ring-offset-background" : "still:border-border",
                )}
                style={accent ? { backgroundColor: accent, borderColor: accent } : { background: "conic-gradient(from 0deg, #f43f5e, #f59e0b, #10b981, #3b82f6, #a855f7, #f43f5e)" }}
              >
                {on && <CheckIcon className="still:size-3.5 still:text-white still:drop-shadow" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A miniature subscription row drawn with the scope's own tokens. */
function PreviewRow({ short }: { short?: boolean }) {
  return (
    <div className="still-card still:flex still:items-center still:gap-2 still:rounded-md still:border still:border-border still:bg-card still:px-2 still:py-1.5 still:shadow-card">
      <span className="still-avatar still:size-5 still:shrink-0 still:bg-primary" />
      <span className="still:flex still:flex-1 still:flex-col still:gap-1">
        <span className={cn("still:h-1.5 still:rounded-full still:bg-foreground/70", short ? "still:w-1/2" : "still:w-3/4")} />
        <span className="still:h-1.5 still:w-1/3 still:rounded-full still:bg-muted-foreground/40" />
      </span>
      <span className="still:rounded still:bg-primary/15 still:px-1.5 still:text-[9px] still:font-semibold still:text-primary">{short ? "12" : "3"}</span>
    </div>
  );
}

export type { ThemeId };
