import type { Appearance } from "@still/core";
import { CheckIcon } from "lucide-react";
import { Segmented } from "../../components/ui/segmented.js";
import { useHostInfo, useI18n } from "../../context.js";
import { cn } from "../../lib/utils.js";
import { ACCENTS, THEMES, applyAppearance, resolveAppearance, type ThemeId } from "../../theme.js";
import { SubscriptionAvatar } from "../SubscriptionAvatar.js";

const DEMO = [
  { name: "Netflix", icon: "service:netflix", color: "#E50914", price: "$15.49", when: 2, day: "6" },
  { name: "Spotify", icon: "service:spotify", color: "#1DB954", price: "$11.99", when: 6, day: "10" },
];

/**
 * Theme cards that preview themselves: each thumbnail is its own `.still-root`
 * scope with that theme applied, rendering the same dock markup the real
 * dock uses — so the preview is the theme, not a picture of it.
 */
export function ThemePicker({ appearance, onChange }: { appearance: Appearance; onChange(patch: Partial<Appearance>): void }) {
  const { t } = useI18n();
  const { scopeClassName, hostDark } = useHostInfo();
  const current = resolveAppearance(appearance, hostDark);

  return (
    <div className="still:grid still:gap-4">
      <div className="still:grid still:grid-cols-2 still:gap-3 still:@xl:grid-cols-4">
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
                "still:group still:relative still:flex still:flex-col still:overflow-hidden still:rounded-xl still:border-2 still:text-left still:transition-all still:cursor-pointer still:hover:-translate-y-0.5",
                selected ? "still:border-primary still:shadow-lg" : "still:border-border/60 still:hover:border-border",
              )}
            >
              <div
                ref={(el) => {
                  if (el) applyAppearance(el, preview);
                }}
                className={cn("still-root", scopeClassName, "stl-thumb")}
                aria-hidden
              >
                <ThumbDock theme={theme.id} />
              </div>
              <div className="still:flex still:items-center still:justify-between still:gap-1 still:border-t still:border-border/60 still:bg-card still:px-3 still:py-2">
                <span className="still:min-w-0">
                  <span className="still:block still:truncate still:text-sm still:font-semibold">{t(`theme.${theme.id}` as const)}</span>
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
          options={(["auto", "light", "dark"] as const).map((v) => ({ value: v, label: t(`settings.mode.${v}`) }))}
        />
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

/** A miniature dock in the real dock markup, for theme thumbnails. */
function ThumbDock({ theme }: { theme: ThemeId }) {
  const { t } = useI18n();
  return (
    <div className="still-panel stl-dock" data-thumb={theme}>
      <header className="stl-head">
        <div className="stl-brandline">STILL · {t("appName")}</div>
        <div className="stl-head-main">
          <div className="stl-head-figure">
            <div className="stl-eyebrow">{t("dock.remainingThisMonth")}</div>
            <div className="stl-big still-amount">¥407.27</div>
          </div>
        </div>
        <div className="stl-progress" style={{ "--p": "18%" } as React.CSSProperties}>
          <i />
        </div>
      </header>
      <section className="stl-group" data-bucket="week">
        <ul className="stl-list">
          {DEMO.map((d) => (
            <li key={d.name}>
              <span className="stl-row" data-urgency={d.when <= 2 ? "hot" : "warm"} style={{ "--brand": d.color } as React.CSSProperties}>
                <span className="stl-date">
                  <b>{d.day}</b>10
                </span>
                <span className="stl-dot" />
                <span className="stl-card">
                  <SubscriptionAvatar subscription={{ icon: d.icon, name: d.name }} className="stl-icon" />
                  <span className="stl-main">
                    <span className="stl-name">
                      <span className="stl-name-text">{d.name}</span>
                    </span>
                    <span className="stl-meta">{t("cycle.month.1")}</span>
                  </span>
                  <span className="stl-leader" />
                  <span className="stl-price still-amount">
                    {d.price}
                    <small className="stl-when">{t("inDays", { n: d.when })}</small>
                  </span>
                  <span className="stl-tminus">T-{d.when}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
