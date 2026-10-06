import { upcomingCharges, type DueReminder } from "@still/core";
import { StillEngine, type EngineEvent } from "@still/engine";
import {
  ReminderDialog,
  ScopeRegistry,
  SubscriptionDialog,
  Toaster,
  createPortal,
  createStillStore,
  createTranslate,
  formatDaysLeft,
  formatMoney,
  guessCurrency,
  mountStill,
  resolveMessages,
  summaryMarkdown,
  type MountContext,
  type StillHost,
  type StillStore,
  type Translate,
} from "@still/ui";
import { Notice, Platform, Plugin, TFolder, addIcon, getLanguage, normalizePath, setIcon, type TAbstractFile } from "obsidian";
import type { ReactNode } from "react";
import { useState } from "react";
import manifest from "../manifest.json" with { type: "json" };
import { createEngineClient, type ObsidianStillClient } from "./client.js";
import { createEngineHost, readDevice } from "./host.js";
import { MarkdownMirror, SummaryBlock, dailyNoteJournal, parseBlockOptions, type SummarySource } from "./notes.js";
import { VaultFileStore } from "./storage.js";
import "./styles.css";
import { ICON, ICON_SVG, ManagerLeafView, StillSettingTab, UpcomingView, VIEW_MANAGER, VIEW_UPCOMING, confirmModal } from "./views.js";
import { overridesFor, ownTranslator } from "./wording.js";

interface PluginData {
  /** Vault folder holding Still's records. */
  folder: string;
  /** The sidebar is opened once on first run; after that it's the user's call. */
  dockShown?: boolean;
  /** Keep one read-only note per subscription (for Bases / Dataview). */
  mirror?: boolean;
}

const DEFAULTS: PluginData = { folder: "Still" };
const SCOPE_CLASS = "still-obsidian";

const isDark = () => document.body.classList.contains("theme-dark");

export default class StillPlugin extends Plugin {
  data: PluginData = { ...DEFAULTS };
  /** Obsidian-only strings. */
  t!: ReturnType<typeof ownTranslator>;
  /** Shared Still strings, with Obsidian wording. */
  ui!: Translate;
  #locale = "en";
  #engine!: StillEngine;
  #files!: VaultFileStore;
  #client!: ObsidianStillClient;
  #store!: StillStore;
  #scopes!: ScopeRegistry;
  #ctx!: Omit<MountContext, "portalContainer">;
  /** One portal per window (popout windows have their own document). */
  readonly #portals = new Map<Document, HTMLElement>();
  readonly #cleanups: (() => void)[] = [];
  #openAdd: (() => void) | null = null;
  #mirror!: MarkdownMirror;

  override async onload() {
    this.data = { ...DEFAULTS, ...((await this.loadData()) as Partial<PluginData> | null) };

    const lang = getLanguage();
    const { locale, messages } = resolveMessages(lang);
    this.#locale = locale;
    const overrides = overridesFor(locale);
    const base = createTranslate({ ...messages, ...overrides });
    this.ui = (key, vars) => base(key, { host: "Obsidian", ...vars });
    this.t = ownTranslator(locale);

    this.#files = new VaultFileStore(this.app.vault.adapter, () => this.data.folder);
    this.#engine = new StillEngine(
      createEngineHost({ plugin: this, files: this.#files, device: readDevice(this.app), lang, emit: (e) => this.#onEngine(e), journal: dailyNoteJournal(this.app) }),
    );
    this.#client = createEngineClient(this.#engine);
    this.#store = createStillStore(this.#client);
    this.#store.setState({ hostDark: isDark() });
    this.#scopes = new ScopeRegistry(this.#store);
    this.registerEvent(this.app.workspace.on("css-change", () => this.#store.setState({ hostDark: isDark() })));

    const host: StillHost = {
      openUrl: (url) => window.open(url, "_blank"),
      confirm: (text) => confirmModal(this.app, this.ui("appName"), text, this.t),
      openManager: () => void this.openManager(),
      saveFile: (filename, content) => void this.#saveToVault(filename, content),
    };
    this.#ctx = {
      store: this.#store,
      client: this.#client,
      host,
      lang,
      hostName: "Obsidian",
      version: manifest.version,
      scopes: this.#scopes,
      scopeClassName: SCOPE_CLASS,
      overrides,
    };

    // Window-level UI (reminder card, toasts, add dialog) lives in the main window's portal.
    const app = document.createElement("div");
    this.portalFor(document).append(app);
    this.#cleanups.push(this.mount(app, <PortalApp register={(open) => (this.#openAdd = open)} />, { fill: false }));

    addIcon(ICON, ICON_SVG);
    this.registerView(VIEW_UPCOMING, (leaf) => new UpcomingView(leaf, this));
    this.registerView(VIEW_MANAGER, (leaf) => new ManagerLeafView(leaf, this));
    this.addRibbonIcon(ICON, this.ui("appName"), () => void this.openManager());
    this.addCommand({ id: "open-upcoming", name: this.t("openDock"), callback: () => void this.openUpcoming() });
    this.addCommand({ id: "open-manager", name: this.t("openManager"), callback: () => void this.openManager() });
    this.addCommand({ id: "add-subscription", name: this.t("addSubscription"), callback: () => this.#openAdd?.() });
    if (Platform.isDesktopApp) this.#registerStatusBar();
    this.addSettingTab(new StillSettingTab(this.app, this));
    this.#registerNotes();

    // Edits that arrive by sync (or a text editor) refresh every view. Only Still's
    // JSON records count (and the folder itself): the mirror's notes live beside them.
    const onVaultChange = (file: TAbstractFile, oldPath?: string) => {
      const paths = [file.path, oldPath].filter((p): p is string => Boolean(p));
      const isData = (p: string) => this.#files.contains(p) && (p.endsWith(".json") || normalizePath(p) === this.#files.folder);
      if (paths.some((p) => isData(p) && !this.#files.isOwnWrite(p))) this.#externalChange();
    };
    this.registerEvent(this.app.vault.on("create", (f) => onVaultChange(f)));
    this.registerEvent(this.app.vault.on("modify", (f) => onVaultChange(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => onVaultChange(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => onVaultChange(f, old)));
    this.registerEvent(this.app.workspace.on("window-close", (win) => this.#dropPortal(win.doc)));
    // Catch up after the app was in the background (laptop sleep, phone locked).
    this.registerDomEvent(window, "focus", () => this.#onVisible());
    this.registerDomEvent(document, "visibilitychange", () => this.#onVisible());

    this.app.workspace.onLayoutReady(() => void this.#ready());
  }

  override onunload() {
    this.#engine?.stop();
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    this.#store?.getState().dispose();
    this.#scopes?.dispose();
    for (const portal of this.#portals.values()) portal.remove();
    this.#portals.clear();
  }

  /** Still's service: the same API the views use, for automation and other plugins. */
  get engine(): StillEngine {
    return this.#engine;
  }

  // ───────────────────────── mounting ─────────────────────────

  portalFor(doc: Document): HTMLElement {
    let portal = this.#portals.get(doc);
    if (!portal) {
      portal = createPortal(doc, this.#ctx);
      this.#portals.set(doc, portal);
    }
    return portal;
  }

  #dropPortal(doc: Document) {
    const portal = this.#portals.get(doc);
    if (!portal) return;
    this.#scopes.delete(portal);
    portal.remove();
    this.#portals.delete(doc);
  }

  /** Renders a Still view into an Obsidian element; dialogs portal into that element's window. */
  mount(container: HTMLElement, node: ReactNode, options?: { fill?: boolean }): () => void {
    return mountStill(container, node, { ...this.#ctx, portalContainer: this.portalFor(container.ownerDocument) }, options);
  }

  // ───────────────────────── views ─────────────────────────

  async openUpcoming(reveal = true) {
    await this.app.workspace.ensureSideLeaf(VIEW_UPCOMING, "right", { active: reveal, reveal });
  }

  async openManager() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_MANAGER)[0];
    if (existing) {
      await workspace.revealLeaf(existing);
      return;
    }
    await workspace.getLeaf("tab").setViewState({ type: VIEW_MANAGER, active: true });
  }

  #registerStatusBar() {
    const el = this.addStatusBarItem();
    el.addClass("still-statusbar");
    el.onClickEvent(() => void this.openManager());
    const render = () => {
      const { subscriptions, today, status } = this.#store.getState();
      if (status !== "ready") return;
      const [next] = upcomingCharges(subscriptions, today);
      el.empty();
      if (!next || next.daysLeft > 7) return;
      setIcon(el.createSpan(), ICON);
      el.createSpan({ text: `${next.subscription.name} · ${formatDaysLeft(next.daysLeft, this.ui)}` });
      el.setAttr("aria-label", formatMoney(next.subscription.price, this.#locale));
    };
    this.#cleanups.push(this.#store.subscribe(render));
  }

  // ───────────────────────── notes ─────────────────────────

  #registerNotes() {
    const source: SummarySource = {
      ready: () => this.#store.getState().status === "ready",
      state: () => this.#store.getState(),
      subscribe: (listener) => this.#store.subscribe(listener),
      t: this.ui,
      locale: this.#locale,
    };
    this.registerMarkdownCodeBlockProcessor("still", (code, el, ctx) => {
      ctx.addChild(new SummaryBlock(el, this.app, source, parseBlockOptions(code), ctx.sourcePath));
    });
    this.addCommand({
      id: "insert-summary",
      name: this.t("insertSummary"),
      editorCallback: (editor) => editor.replaceSelection(`${summaryMarkdown(this.#store.getState(), this.ui, this.#locale)}\n`),
    });
    this.addCommand({
      id: "insert-live-table",
      name: this.t("insertLiveTable"),
      editorCallback: (editor) => editor.replaceSelection("```still\ndays: 30\n```\n"),
    });

    this.#mirror = new MarkdownMirror(this.app, () => this.data.folder, this.ui, { managed: this.t("mirrorManaged") });
    let timer = 0;
    let last = "";
    this.#cleanups.push(
      this.#store.subscribe((s) => {
        if (!this.data.mirror || s.status !== "ready") return;
        const key = JSON.stringify([s.subscriptions.map((x) => x.updatedAt), s.today, this.data.folder]);
        if (key === last) return;
        last = key;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void this.#syncMirror(), 800);
      }),
    );
    this.#cleanups.push(() => window.clearTimeout(timer));
  }

  async #syncMirror() {
    const { subscriptions, today } = this.#store.getState();
    try {
      await this.#mirror.sync(subscriptions, today);
    } catch (e) {
      console.warn("[still] Markdown mirror failed", e);
    }
  }

  /** Turns the Markdown mirror on or off. */
  async setMirror(on: boolean) {
    this.data.mirror = on;
    await this.saveData(this.data);
    if (on) {
      await this.#mirror.ensureBase(this.t("baseName"));
      await this.#syncMirror();
    }
  }

  // ───────────────────────── data ─────────────────────────

  /** Moves Still's data to another vault folder; returns the folder now in use. */
  async setFolder(input: string): Promise<string> {
    const next = normalizePath(input.trim() || DEFAULTS.folder);
    const current = this.data.folder;
    if (next === normalizePath(current)) return current;
    if (next.split("/").some((part) => part === ".." || part.startsWith("."))) {
      new Notice(this.t("folderInvalid"));
      return current;
    }
    const { vault, fileManager } = this.app;
    const from = vault.getAbstractFileByPath(normalizePath(current));
    if (from instanceof TFolder) {
      if (vault.getAbstractFileByPath(next)) {
        new Notice(this.t("folderTaken", { folder: next }));
        return current;
      }
      await fileManager.renameFile(from, next);
      new Notice(this.t("folderMoved", { folder: next }));
    }
    this.data.folder = next;
    await this.saveData(this.data);
    await this.#engine.externalChange();
    return next;
  }

  async #saveToVault(filename: string, content: string) {
    const dot = filename.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [filename.slice(0, dot), filename.slice(dot)] : [filename, ""];
    let path = normalizePath(filename);
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${stem} ${n}${ext}`);
    await this.app.vault.create(path, content);
    new Notice(this.t("saved", { path }));
  }

  // ───────────────────────── reminders ─────────────────────────

  async #ready() {
    this.#engine.start();
    await this.#sync();
    if (!this.data.dockShown) {
      this.data.dockShown = true;
      await this.saveData(this.data);
      await this.openUpcoming(false);
    }
  }

  #lastSync = 0;
  async #sync() {
    this.#lastSync = Date.now();
    await this.#store.getState().refresh();
    const { status, settings, saveSettings } = this.#store.getState();
    // First run: pick the currency the user most likely pays in.
    if (status === "ready" && settings.updatedAt === null) {
      void saveSettings({ defaultCurrency: guessCurrency(this.#locale) }).catch(() => undefined);
    }
    try {
      await this.#deliver(await this.#client.pendingReminders());
    } catch (e) {
      console.warn("[still] pendingReminders failed", e);
    }
  }

  /** Claims due reminders for this device, notifies, and queues the decision cards. */
  async #deliver(reminders: DueReminder[]) {
    if (reminders.length === 0) return;
    const claimed = new Set(await this.#client.claimReminders(reminders.map((r) => r.key)));
    const mine = reminders.filter((r) => claimed.has(r.key));
    if (mine.length === 0) return;
    await this.#store.getState().refresh();
    const { subscriptions } = this.#store.getState();
    for (const r of mine) {
      const sub = subscriptions.find((s) => s.id === r.subscriptionId);
      if (!sub) continue;
      const when = formatDaysLeft(r.daysLeft, this.ui);
      const title = this.ui(r.kind === "trial-ending" ? "notification.trialTitle" : "notification.title", { name: sub.name, when });
      const body = this.ui("notification.body", { price: formatMoney(sub.price, this.#locale) });
      notify(title, body);
    }
    this.#store.getState().enqueueReminders(mine);
  }

  #onEngine(event: EngineEvent) {
    if (event.type === "changed") void this.#store.getState().refresh();
    else void this.#deliver(event.reminders).catch((e) => console.warn("[still] deliver failed", e));
  }

  #changeTimer = 0;
  #externalChange() {
    window.clearTimeout(this.#changeTimer);
    this.#changeTimer = window.setTimeout(() => void this.#engine.externalChange(), 500);
  }

  #onVisible() {
    if (document.visibilityState !== "visible" || Date.now() - this.#lastSync < 10_000) return;
    void this.#sync();
  }
}

/** A system notification on desktop; an in-app notice on mobile, where plugins can't post system ones. */
function notify(title: string, body: string) {
  if (Platform.isDesktopApp && typeof Notification === "function") {
    try {
      new Notification(title, { body });
      return;
    } catch {
      // fall through to a notice
    }
  }
  new Notice(`${title}\n${body}`, 8000);
}

/** Window-level UI mounted once: the reminder card, toasts and a command-driven add dialog. */
function PortalApp({ register }: { register(open: () => void): void }) {
  const [adding, setAdding] = useState(false);
  register(() => setAdding(true));
  return (
    <>
      <ReminderDialog />
      <Toaster />
      <SubscriptionDialog open={adding} onOpenChange={setAdding} subscription={null} />
    </>
  );
}
