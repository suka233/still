/**
 * SiYuan's side of delivery: daily-note entries through the kernel API, and
 * the text for push/journal messages.
 */
import { createTranslator, messagesFor, type JournalHost } from "@still/engine";

/** Push and daily-note text: SiYuan's loaded i18n (which build.mjs fills from the engine catalog), else the engine catalog. */
export function translator(lang: string) {
  const loaded = (siyuan.plugin.i18n ?? {}) as Record<string, string>;
  return createTranslator({ ...messagesFor(lang), ...loaded });
}

async function appendToDailyNote(notebook: string, line: string): Promise<boolean> {
  try {
    const res = await siyuan.client.fetch("/api/block/appendDailyNoteBlock", {
      method: "POST",
      body: JSON.stringify({ notebook, dataType: "markdown", data: line }),
    });
    const json = (await res.json()) as { code: number; msg?: string };
    if (json.code !== 0) await siyuan.logger.warn("appendDailyNoteBlock failed", json.msg ?? String(json.code));
    return json.code === 0;
  } catch (e) {
    await siyuan.logger.warn("appendDailyNoteBlock failed", String(e));
    return false;
  }
}

/** SiYuan daily notes live in a notebook the user picks in settings. */
export const journal: JournalHost = {
  canWrite: (settings) => Boolean(settings.notebookId),
  append: (settings, line) => appendToDailyNote(settings.notebookId!, line),
};

export async function listNotebooks(): Promise<{ id: string; name: string }[]> {
  const res = await siyuan.client.fetch("/api/notebook/lsNotebooks", { method: "POST", body: "{}" });
  const json = (await res.json()) as { code: number; data?: { notebooks?: { id: string; name: string; closed: boolean }[] } };
  return (json.data?.notebooks ?? []).filter((n) => !n.closed).map((n) => ({ id: n.id, name: n.name }));
}
