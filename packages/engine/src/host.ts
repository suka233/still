import type { DueReminder, FileStore, NotificationSettings } from "@still/core";

/**
 * What the engine needs from the platform it runs on. SiYuan provides it from
 * a kernel plugin (goja), Obsidian from the plugin's main thread, a server
 * from Node. Everything here must stay free of DOM and Node APIs.
 */
export interface EngineHost {
  /** Record storage (one file per record, see `PATHS`). */
  files: FileStore;
  /** This device; `deviceId` must only contain [0-9A-Za-z] (it becomes an HLC node id). */
  device: DeviceInfo;
  /** Outbound HTTP for exchange rates and push channels. */
  http(request: HttpRequest): Promise<HttpResponse>;
  /** Translates push and daily-note text (keys in `messages/*.json`). */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Tells open views that data changed or reminders became due. */
  emit(event: EngineEvent): void | Promise<void>;
  log: {
    warn(message: string, detail?: string): void | Promise<void>;
    error(message: string, detail?: string): void | Promise<void>;
  };
  /** Runs `fn` every `ms`; returns a function that stops it. */
  every(ms: number, fn: () => void): () => void;
  /** Daily-note entries, where the host has daily notes. */
  journal?: JournalHost;
  /** Called after the engine wrote to storage, before it announces the change (e.g. to refresh a change fingerprint). */
  afterWrite?(): Promise<void>;
  /** Defaults to the system clock. */
  now?(): Date;
}

export interface JournalHost {
  /** Whether entries can be written with these settings (e.g. a notebook is chosen). */
  canWrite(settings: NotificationSettings["journal"]): boolean;
  /** Appends one Markdown line to today's daily note; resolves false if it didn't work. */
  append(settings: NotificationSettings["journal"], line: string): Promise<boolean>;
}

export type EngineEvent = { type: "changed"; source: "write" | "storage" } | { type: "reminders-due"; reminders: DueReminder[] };

export interface DeviceInfo {
  deviceId: string;
  name: string;
  os: string;
}

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  /** Sent as JSON unless `text` is set. */
  json?: unknown;
  text?: string;
  contentType?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
  json<T = unknown>(): T | null;
}

/** A response object for hosts whose HTTP client returns status + text. */
export function httpResponse(status: number, body: string): HttpResponse {
  return {
    status,
    body,
    json<T>() {
      try {
        return JSON.parse(body) as T;
      } catch {
        return null;
      }
    },
  };
}
