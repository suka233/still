import type { Appearance } from "@still/core";

/**
 * Still's themes. Each one changes structure as well as colour: views render
 * one superset markup (`stl-*` classes) and each theme's CSS decides what's
 * shown and how it's laid out (see themes.css).
 */
export type ThemeId = "thermal" | "boutique" | "ticket" | "riso" | "swiss" | "calm" | "wallet" | "timeline";

export interface ThemeInfo {
  id: ThemeId;
  /** Picker swatches: background, surface, accent, ink. */
  light: [string, string, string, string];
  dark: [string, string, string, string];
}

export const THEMES: readonly ThemeInfo[] = [
  { id: "thermal", light: ["#e6e3dd", "#fcfbf8", "#d23a1f", "#1c1c1e"], dark: ["#0d0d0e", "#1e1e21", "#ff6b4f", "#ecebe6"] },
  { id: "boutique", light: ["#e8e2d6", "#fdfaf4", "#8e2f3a", "#2a2521"], dark: ["#11100e", "#1f1b18", "#e08a7c", "#efe6d7"] },
  { id: "ticket", light: ["#eee3cf", "#fffaf0", "#e2553f", "#1e2a45"], dark: ["#0d1220", "#1a2235", "#ff7a5c", "#f3ebda"] },
  { id: "riso", light: ["#e9e3d6", "#f7f2e8", "#ff4fa3", "#0a5fb4"], dark: ["#0c0c12", "#17171f", "#ff6ec0", "#6fb6ff"] },
  { id: "swiss", light: ["#ebebea", "#ffffff", "#ff4f00", "#111111"], dark: ["#050505", "#151515", "#ff6a2b", "#f4f4f4"] },
  { id: "calm", light: ["#f2f2f7", "#ffffff", "#007aff", "#1c1c1e"], dark: ["#000000", "#1c1c1e", "#0a84ff", "#f2f2f7"] },
  { id: "wallet", light: ["#efeefb", "#ffffff", "#7c5cfa", "#1d1b2e"], dark: ["#0b0d13", "#171a24", "#9b5cf6", "#eef0f6"] },
  { id: "timeline", light: ["#f7f7f8", "#ffffff", "#5b5bd6", "#18181b"], dark: ["#0f0f11", "#18181b", "#8b8bf0", "#fafafa"] },
];

export const DEFAULT_THEME: ThemeId = "thermal";

/** Retired theme IDs and the theme that replaced them. */
const LEGACY_THEMES: Record<string, ThemeId> = { receipt: "thermal" };

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

/** Retired theme IDs map to their replacement; unknown ones fall back to the default theme. */
export function resolveAppearance(appearance: Appearance, hostDark: boolean): ResolvedAppearance {
  const theme = isThemeId(appearance.theme) ? appearance.theme : (LEGACY_THEMES[appearance.theme] ?? DEFAULT_THEME);
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
