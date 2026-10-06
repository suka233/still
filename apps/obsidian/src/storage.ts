import type { FileStore } from "@still/core";
import { normalizePath, type DataAdapter } from "obsidian";

/** A vault event this soon after our own write to the same file is that write's echo. */
const ECHO_MS = 3000;

/**
 * Still's records as files in a vault folder (default `Still/`), one JSON file
 * per record, in the same layout the SiYuan plugin uses. Living in the vault
 * means every sync method (Obsidian Sync, iCloud, Syncthing, git) carries them.
 */
export class VaultFileStore implements FileStore {
  readonly #adapter: DataAdapter;
  readonly #folder: () => string;
  readonly #recent = new Map<string, number>();

  constructor(adapter: DataAdapter, folder: () => string) {
    this.#adapter = adapter;
    this.#folder = folder;
  }

  get folder(): string {
    return normalizePath(this.#folder());
  }

  #path(relative: string): string {
    return relative === "." || relative === "" ? this.folder : normalizePath(`${this.folder}/${relative}`);
  }

  async read(relative: string): Promise<string | null> {
    const path = this.#path(relative);
    try {
      return (await this.#adapter.exists(path)) ? await this.#adapter.read(path) : null;
    } catch {
      return null;
    }
  }

  async write(relative: string, content: string): Promise<void> {
    const path = this.#path(relative);
    await this.#ensureParent(path);
    this.#recent.set(path, Date.now());
    await this.#adapter.write(path, content);
  }

  async list(relative: string): Promise<string[]> {
    const path = this.#path(relative);
    try {
      if (!(await this.#adapter.exists(path))) return [];
      const { files } = await this.#adapter.list(path);
      return files.map((f) => f.slice(f.lastIndexOf("/") + 1));
    } catch {
      return [];
    }
  }

  /** Whether a vault path belongs to Still's data. */
  contains(path: string): boolean {
    const folder = this.folder;
    return path === folder || path.startsWith(`${folder}/`);
  }

  /** True when a vault event for `path` is just the echo of our own recent write. */
  isOwnWrite(path: string): boolean {
    const at = this.#recent.get(normalizePath(path));
    return at !== undefined && Date.now() - at < ECHO_MS;
  }

  async #ensureParent(path: string) {
    const parts = path.split("/").slice(0, -1);
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      if (!(await this.#adapter.exists(dir))) await this.#adapter.mkdir(dir);
    }
  }
}
