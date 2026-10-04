import type { Appearance } from "@still/core";

/**
 * Still's themes. Each one changes structure as well as colour: views render
 * one superset markup (`stl-*` classes) and each theme's CSS decides what's
 * shown and how it's laid out (see themes.css).
 */
export type ThemeId = "receipt" | "calm" | "wallet" | "timeline";

export interface ThemeInfo {
  id: ThemeId;
  /** Picker swatches: background, surface, accent, ink. */
  light: [string, string, string, string];
  dark: [string, string, string, string];
}

export const THEMES: readonly ThemeInfo[] = [
  { id: "receipt", light: ["#e9e2d4", "#fffdf6", "#c2410c", "#2b2621"], dark: ["#15120e", "#24201a", "#f0855e", "#ece3d3"] },
  { id: "calm", light: ["#f2f2f7", "#ffffff", "#007aff", "#1c1c1e"], dark: ["#000000", "#1c1c1e", "#0a84ff", "#f2f2f7"] },
  { id: "wallet", light: ["#efeefb", "#ffffff", "#7c5cfa", "#1d1b2e"], dark: ["#0b0d13", "#171a24", "#9b5cf6", "#eef0f6"] },
  { id: "timeline", light: ["#f7f7f8", "#ffffff", "#5b5bd6", "#18181b"], dark: ["#0f0f11", "#18181b", "#8b8bf0", "#fafafa"] },
];

export const DEFAULT_THEME: ThemeId = "receipt";

export function isThemeId(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

/** Accent presets; `null` keeps the theme's own accent colour. */
export const ACCENTS: readonly (string | null)[] = [null, "#3b82f6", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#0891b2"];

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  return relativeLuminance(hex) > 0.45 ? "#111111" : "#ffffff";
}

export interface ResolvedAppearance {
  theme: ThemeId;
  dark: boolean;
  /** Inline custom properties (accent override). */
  style: Record<string, string>;
}

/** Unknown or retired theme IDs fall back to the default theme. */
export function resolveAppearance(appearance: Appearance, hostDark: boolean): ResolvedAppearance {
  const theme = isThemeId(appearance.theme) ? appearance.theme : DEFAULT_THEME;
  const dark = appearance.mode === "auto" ? hostDark : appearance.mode === "dark";
  const style: Record<string, string> = {};
  if (appearance.accent) {
    style["--primary"] = appearance.accent;
    style["--primary-foreground"] = readableOn(appearance.accent);
    style["--ring"] = appearance.accent;
    style["--chart"] = appearance.accent;
  }
  return { theme, dark, style };
}

const ACCENT_PROPS = ["--primary", "--primary-foreground", "--ring", "--chart"];

/** Applies an appearance to a `.still-root` scope element. */
export function applyAppearance(el: HTMLElement, resolved: ResolvedAppearance) {
  el.dataset.stillTheme = resolved.theme;
  el.dataset.stillMode = resolved.dark ? "dark" : "light";
  for (const prop of ACCENT_PROPS) el.style.removeProperty(prop);
  for (const [prop, value] of Object.entries(resolved.style)) el.style.setProperty(prop, value);
}
