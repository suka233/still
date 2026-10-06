import { ManagerView, SettingsView, UpcomingPanel } from "@still/ui";
import { ItemView, Modal, PluginSettingTab, Setting, type App, type WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";
import type StillPlugin from "./main.js";
import type { ownTranslator } from "./wording.js";

export const VIEW_UPCOMING = "still-upcoming";
export const VIEW_MANAGER = "still-manager";
export const ICON = "still";

/** Still's renewal loop with a check mark, on Obsidian's 100×100 icon grid. */
export const ICON_SVG = `<g transform="scale(3.125)" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M26.5 13.5A11 11 0 0 0 6.2 9.6M5.5 18.5a11 11 0 0 0 20.3 3.9"/>
<path d="M5.6 4.5v5.6h5.6M26.4 27.5v-5.6h-5.6"/>
<path d="m11.5 16 3.2 3.2 6-6.4"/>
</g>`;

/**
 * A leaf rendering one of Still's React views. Obsidian's View constructor
 * calls getViewType()/getDisplayText() before subclass fields exist, so those
 * read nothing set in the constructor.
 */
abstract class StillLeafView extends ItemView {
  protected plugin: StillPlugin;
  #unmount: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: StillPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  protected abstract render(): ReactNode;

  getDisplayText(): string {
    return this.plugin?.ui("appName") ?? "Still";
  }

  override getIcon(): string {
    return ICON;
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.#unmount = this.plugin.mount(this.contentEl, this.render());
  }

  override async onClose(): Promise<void> {
    this.#unmount?.();
    this.#unmount = null;
  }
}

/** Upcoming charges, in the right sidebar. */
export class UpcomingView extends StillLeafView {
  getViewType(): string {
    return VIEW_UPCOMING;
  }
  protected render() {
    return <UpcomingPanel />;
  }
}

/** All subscriptions, calendar, insights and settings, in a main-area tab. */
export class ManagerLeafView extends StillLeafView {
  override navigation = true;
  getViewType(): string {
    return VIEW_MANAGER;
  }
  protected render() {
    return <ManagerView />;
  }
}

/** A yes/no question in Obsidian's own modal. */
export function confirmModal(app: App, title: string, message: string, t: ReturnType<typeof ownTranslator>): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const modal = new (class extends Modal {
      override onOpen() {
        this.titleEl.setText(title);
        this.contentEl.createEl("p", { text: message });
        new Setting(this.contentEl)
          .addButton((b) =>
            b.setButtonText(t("cancel")).onClick(() => {
              answered = true;
              resolve(false);
              this.close();
            }),
          )
          .addButton((b) =>
            b
              .setButtonText(t("confirm"))
              .setCta()
              .onClick(() => {
                answered = true;
                resolve(true);
                this.close();
              }),
          );
      }
      override onClose() {
        this.contentEl.empty();
        if (!answered) resolve(false);
      }
    })(app);
    modal.open();
  });
}

/**
 * Obsidian's settings tab: the data folder (an Obsidian-only setting), then
 * Still's own settings view, the same one the manager shows.
 */
export class StillSettingTab extends PluginSettingTab {
  readonly #plugin: StillPlugin;
  #unmount: (() => void) | null = null;

  constructor(app: App, plugin: StillPlugin) {
    super(app, plugin);
    this.#plugin = plugin;
  }

  override display(): void {
    const { containerEl } = this;
    const plugin = this.#plugin;
    this.#unmount?.();
    containerEl.empty();
    new Setting(containerEl)
      .setName(plugin.t("folder"))
      .setDesc(plugin.t("folderDesc"))
      .addText((text) => {
        text.setPlaceholder("Still").setValue(plugin.data.folder);
        // Commit on blur/enter, not on every keystroke: a rename moves files.
        text.inputEl.addEventListener("change", () => {
          void plugin.setFolder(text.getValue()).then((folder) => text.setValue(folder));
        });
      });
    this.#unmount = plugin.mount(containerEl.createDiv({ cls: "still-settings-host" }), <SettingsView />, { fill: false });
  }

  override hide(): void {
    this.#unmount?.();
    this.#unmount = null;
    this.containerEl.empty();
  }
}
