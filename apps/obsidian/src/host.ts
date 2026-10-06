import { createTranslator, httpResponse, messagesFor, type DeviceInfo, type EngineEvent, type EngineHost, type HttpRequest, type HttpResponse, type JournalHost } from "@still/engine";
import { Platform, requestUrl, type App, type Plugin } from "obsidian";
import type { VaultFileStore } from "./storage.js";

const DEVICE_KEY = "still-device-id";

/**
 * This device: a random ID kept in Obsidian's per-vault local storage (which
 * isn't synced, so every device gets its own), plus a readable name.
 */
export function readDevice(app: App): DeviceInfo {
  let id = app.loadLocalStorage(DEVICE_KEY) as string | null;
  if (typeof id !== "string" || !/^[0-9A-Za-z]{6,16}$/.test(id)) {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    id = `o${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`.slice(0, 13);
    app.saveLocalStorage(DEVICE_KEY, id);
  }
  const os = Platform.isIosApp ? "ios" : Platform.isAndroidApp ? "android" : Platform.isMacOS ? "darwin" : Platform.isWin ? "windows" : Platform.isLinux ? "linux" : "unknown";
  let name = "";
  if (Platform.isDesktopApp) {
    try {
      // Desktop Obsidian runs with Node integration.
      const nodeRequire = (window as unknown as { require?: (id: string) => unknown }).require;
      name = (nodeRequire?.("os") as { hostname(): string } | undefined)?.hostname() ?? "";
    } catch {
      name = "";
    }
  }
  if (!name) name = Platform.isIosApp ? "iPhone / iPad" : Platform.isAndroidApp ? "Android" : "Obsidian";
  return { deviceId: id, name, os };
}

/** Obsidian's requestUrl (no CORS limits, works on mobile) with a timeout it doesn't have natively. */
async function http(req: HttpRequest): Promise<HttpResponse> {
  const body = req.text ?? (req.json !== undefined ? JSON.stringify(req.json) : undefined);
  const contentType = req.text !== undefined ? (req.contentType ?? "text/plain; charset=utf-8") : req.json !== undefined ? (req.contentType ?? "application/json") : undefined;
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("request timed out")), req.timeoutMs ?? 10_000);
  });
  try {
    const res = await Promise.race([requestUrl({ url: req.url, method: req.method ?? "GET", headers: req.headers, body, contentType, throw: false }), timeout]);
    return httpResponse(res.status, res.text);
  } finally {
    window.clearTimeout(timer);
  }
}

export interface HostOptions {
  plugin: Plugin;
  files: VaultFileStore;
  device: DeviceInfo;
  lang: string;
  emit(event: EngineEvent): void | Promise<void>;
  journal?: JournalHost;
}

export function createEngineHost({ plugin, files, device, lang, emit, journal }: HostOptions): EngineHost {
  return {
    files,
    device,
    http,
    t: createTranslator(messagesFor(lang)),
    emit,
    log: {
      warn: (message, detail) => console.warn(`[still] ${message}`, detail ?? ""),
      error: (message, detail) => console.error(`[still] ${message}`, detail ?? ""),
    },
    every(ms, fn) {
      const id = window.setInterval(fn, ms);
      plugin.registerInterval(id);
      return () => window.clearInterval(id);
    },
    journal,
  };
}
