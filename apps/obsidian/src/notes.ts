/**
 * Still in the vault's notes: daily-note entries, the live `still` code
 * block, and the optional read-only Markdown mirror (one note per
 * subscription with its data as properties, for Bases and Dataview).
 */
import { monthlyEquivalent, nextOccurrence, toMajor, type LocalDate, type Subscription } from "@still/core";
import type { JournalHost } from "@still/engine";
import { formatCycle, summaryMarkdown, type SummaryOptions, type SummaryState, type Translate } from "@still/ui";
import { MarkdownRenderChild, MarkdownRenderer, TFile, moment, normalizePath, type App, type Component } from "obsidian";

// ───────────────────────── daily notes ─────────────────────────

/** Obsidian's bundled moment (its typings don't expose the call signature). */
const now = () => (moment as unknown as () => { format(pattern: string): string })();

interface DailyNoteOptions {
  folder: string;
  format: string;
  template: string;
}

/** The core Daily notes plugin's settings (folder, date format, template), or its defaults when it's off. */
function dailyNoteOptions(app: App): DailyNoteOptions {
  const plugin = (app as unknown as { internalPlugins?: { getPluginById(id: string): { enabled: boolean; instance?: { options?: Partial<DailyNoteOptions> } } | null } }).internalPlugins?.getPluginById("daily-notes");
  const options = plugin?.enabled ? (plugin.instance?.options ?? {}) : {};
  return { folder: (options.folder ?? "").trim(), format: options.format?.trim() || "YYYY-MM-DD", template: (options.template ?? "").trim() };
}

export async function ensureFolder(app: App, folder: string) {
  const parts = normalizePath(folder).split("/").filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    const path = parts.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
  }
}

/** Fills the template variables the core plugin understands: {{title}}, {{date}}, {{time}}, {{date:FORMAT}}. */
function fillTemplate(text: string, title: string): string {
  const at = now();
  return text
    .replace(/\{\{\s*title\s*\}\}/gi, title)
    .replace(/\{\{\s*(date|time)\s*(?::\s*([^}]+?))?\s*\}\}/gi, (_, kind: string, format?: string) => at.format(format?.trim() || (kind.toLowerCase() === "time" ? "HH:mm" : "YYYY-MM-DD")));
}

/** Writes entries into today's daily note, creating it (from the template) when it doesn't exist yet. */
export function dailyNoteJournal(app: App): JournalHost {
  return {
    canWrite: () => true,
    async append(_settings, line) {
      try {
        const { folder, format, template } = dailyNoteOptions(app);
        const title = now().format(format);
        const path = normalizePath(folder ? `${folder}/${title}.md` : `${title}.md`);
        let file = app.vault.getFileByPath(path);
        if (!file) {
          let content = "";
          const templateFile = template ? app.vault.getFileByPath(normalizePath(template.endsWith(".md") ? template : `${template}.md`)) : null;
          if (templateFile) content = fillTemplate(await app.vault.read(templateFile), title);
          const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
          if (dir) await ensureFolder(app, dir);
          file = await app.vault.create(path, content);
        }
        await app.vault.process(file, (data) => `${data}${data === "" || data.endsWith("\n") ? "" : "\n"}${line}\n`);
        return true;
      } catch (e) {
        console.warn("[still] daily note entry failed", e);
        return false;
      }
    },
  };
}

// ───────────────────────── the `still` code block ─────────────────────────

/**
 * Options, one per line: `days: 30` (only charges within 30 days),
 * `limit: 5` (at most 5 rows). Unknown lines are ignored.
 */
export function parseBlockOptions(source: string): SummaryOptions {
  const options: SummaryOptions = {};
  for (const line of source.split("\n")) {
    const m = /^\s*(days|limit)\s*[:=]\s*(\d{1,4})\s*$/i.exec(line);
    if (m) options[m[1]!.toLowerCase() as keyof SummaryOptions] = Number(m[2]);
  }
  return options;
}

export interface SummarySource {
  ready(): boolean;
  state(): SummaryState;
  subscribe(listener: () => void): () => void;
  t: Translate;
  locale: string;
}

/** A live table of upcoming charges inside a note, rendered as native Markdown and kept current. */
export class SummaryBlock extends MarkdownRenderChild {
  #timer = 0;
  #last = "";

  constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly source: SummarySource,
    private readonly options: SummaryOptions,
    private readonly sourcePath: string,
  ) {
    super(containerEl);
  }

  override onload() {
    this.containerEl.addClass("still-summary");
    void this.#render();
    this.register(
      this.source.subscribe(() => {
        window.clearTimeout(this.#timer);
        this.#timer = window.setTimeout(() => void this.#render(), 200);
      }),
    );
    this.register(() => window.clearTimeout(this.#timer));
  }

  async #render() {
    const markdown = this.source.ready() ? summaryMarkdown(this.source.state(), this.source.t, this.source.locale, this.options) : "…";
    if (markdown === this.#last) return;
    this.#last = markdown;
    this.containerEl.empty();
    await MarkdownRenderer.render(this.app, markdown, this.containerEl, this.sourcePath, this as Component);
  }
}

// ───────────────────────── Markdown mirror ─────────────────────────

const ID_KEY = "still_id";
const ID_LINE = new RegExp(`^${ID_KEY}:\\s*"?([^"\\n]+)"?\\s*$`, "m");

/** YAML scalar: JSON strings are valid YAML and need no further escaping. */
const yamlString = (s: string) => JSON.stringify(s);

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Subscription";
}

export interface MirrorText {
  managed: string;
}

/**
 * Keeps one note per subscription in `<data folder>/Notes`, with the
 * subscription as properties. Still owns these notes: edits are overwritten,
 * and notes of deleted subscriptions go to the trash. Notes without a
 * `still_id` property are never touched.
 */
export class MarkdownMirror {
  #running: Promise<void> | null = null;
  #again = false;

  constructor(
    private readonly app: App,
    private readonly folder: () => string,
    private readonly t: Translate,
    private readonly text: MirrorText,
  ) {}

  /** Not "Subscriptions": on case-insensitive file systems that is the `subscriptions/` data folder. */
  get notesFolder(): string {
    return normalizePath(`${this.folder()}/Notes`);
  }

  /** Brings the notes in line with `subscriptions`; calls made meanwhile coalesce into one more run. */
  sync(subscriptions: readonly Subscription[], today: LocalDate): Promise<void> {
    if (this.#running) {
      this.#again = true;
      return this.#running;
    }
    this.#running = (async () => {
      try {
        do {
          this.#again = false;
          await this.#sync(subscriptions, today);
        } while (this.#again);
      } finally {
        this.#running = null;
      }
    })();
    return this.#running;
  }

  render(sub: Subscription, today: LocalDate): string {
    const next = sub.status === "active" && (!sub.endDate || sub.endDate >= today) ? nextOccurrence(sub.anchorDate, sub.cycle, today) : null;
    const monthly = toMajor(Math.round(monthlyEquivalent(sub.price.amount, sub.cycle)), sub.price.currency);
    const props: [string, string | number | null][] = [
      [ID_KEY, yamlString(sub.id)],
      ["name", yamlString(sub.name)],
      ["status", sub.status],
      ["price", toMajor(sub.price.amount, sub.price.currency)],
      ["currency", sub.price.currency],
      ["cycle", yamlString(formatCycle(sub.cycle, this.t))],
      ["monthly_cost", monthly],
      ["next_charge", next],
      ["trial_ends", sub.trialEndsOn ?? null],
      ["end_date", sub.endDate ?? null],
      ["category", sub.category ? yamlString(sub.category) : null],
      ["url", sub.url ? yamlString(sub.url) : null],
      ["cancel_url", sub.cancelUrl ? yamlString(sub.cancelUrl) : null],
    ];
    const tags = ["still/subscription", ...(sub.tags ?? []).map((t) => t.replace(/\s+/g, "-"))];
    const front = [
      "---",
      ...props.filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${v}`),
      `tags: [${tags.map(yamlString).join(", ")}]`,
      "---",
    ];
    const body = [sub.note?.trim() ?? "", `> ${this.text.managed}`].filter(Boolean);
    return `${front.join("\n")}\n\n${body.join("\n\n")}\n`;
  }

  async #sync(subscriptions: readonly Subscription[], today: LocalDate) {
    const { vault, fileManager } = this.app;
    const folder = this.notesFolder;
    await ensureFolder(this.app, folder);

    const byId = new Map<string, TFile>();
    for (const file of vault.getFolderByPath(folder)?.children ?? []) {
      if (!(file instanceof TFile) || file.extension !== "md") continue;
      const id = ID_LINE.exec(await vault.cachedRead(file))?.[1];
      if (id) byId.set(id, file);
    }

    const taken = new Set<string>();
    const pathFor = (sub: Subscription, own?: TFile) => {
      const base = safeFileName(sub.name);
      for (const candidate of [base, `${base} (${sub.id.slice(0, 4)})`, `${base} (${sub.id})`]) {
        const path = normalizePath(`${folder}/${candidate}.md`);
        const existing = vault.getAbstractFileByPath(path);
        if (!taken.has(path) && (!existing || existing === own)) return path;
      }
      return normalizePath(`${folder}/${sub.id}.md`);
    };

    for (const sub of subscriptions) {
      const content = this.render(sub, today);
      const own = byId.get(sub.id);
      const path = pathFor(sub, own);
      taken.add(path);
      if (!own) {
        await vault.create(path, content);
        continue;
      }
      if ((await vault.cachedRead(own)) !== content) await vault.modify(own, content);
      if (own.path !== path) await fileManager.renameFile(own, path);
    }

    const live = new Set(subscriptions.map((s) => s.id));
    for (const [id, file] of byId) if (!live.has(id)) await fileManager.trashFile(file);
  }

  /** A Bases view over the notes, created once (the user may edit it afterwards). */
  async ensureBase(name: string) {
    const path = normalizePath(`${this.folder()}/${name}.base`);
    if (this.app.vault.getAbstractFileByPath(path)) return;
    const base = [
      "filters:",
      "  and:",
      `    - file.inFolder(${yamlString(this.notesFolder)})`,
      "views:",
      "  - type: table",
      `    name: ${yamlString(name)}`,
      "    order:",
      "      - file.name",
      "      - price",
      "      - currency",
      "      - cycle",
      "      - next_charge",
      "      - monthly_cost",
      "      - status",
      "      - category",
      "",
    ].join("\n");
    await ensureFolder(this.app, this.folder());
    await this.app.vault.create(path, base);
  }
}
