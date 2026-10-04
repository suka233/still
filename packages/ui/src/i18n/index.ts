import { en, type Messages } from "./en.js";
import { zh } from "./zh.js";

export type { Messages };
export type MessageKey = keyof Messages;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const catalogs: Record<string, Messages> = { en, zh };

/** Picks a catalog for a BCP 47 tag or host code such as `zh_CN` / `en-US`. */
export function resolveMessages(lang: string | undefined): { locale: string; messages: Messages } {
  const locale = (lang ?? "en").replace("_", "-");
  const base = locale.split("-")[0]!.toLowerCase();
  return { locale, messages: catalogs[base] ?? en };
}

export function createTranslate(messages: Messages): Translate {
  return (key, vars) => {
    let text = messages[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
    return text;
  };
}
