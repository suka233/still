/**
 * Still kernel plugin. Runs inside SiYuan's Go kernel (goja), independently of
 * any open window. The service itself is `@still/engine`; this file adapts it
 * to SiYuan: storage, forward-proxy HTTP, daily notes, change detection and
 * JSON-RPC (see `../shared/rpc.ts`) with `changed` / `reminders-due` pushes.
 */
import { NotFoundError, PATHS, ValidationError, type FileStore } from "@still/core";
import { StillEngine, type DeviceInfo, type EngineHost } from "@still/engine";
import { RPC, type RpcErrorData } from "../shared/rpc.js";
import { registerAgentCapability } from "./agent.js";
import { httpRequest } from "./http.js";
import { journal, listNotebooks, translator } from "./notify.js";

/** How often storage is checked for changes made elsewhere (sync, other devices). */
const POLL_MS = 15_000;
/** Directories watched for changes, relative to the plugin's storage dir. */
const WATCHED = [".", PATHS.subscriptionsDir, PATHS.decisionsDir, PATHS.deliveredDir];

const files: FileStore = {
  async read(path) {
    try {
      return await (await siyuan.storage.get(path)).text();
    } catch {
      return null; // `get` rejects for missing files
    }
  },
  async write(path, content) {
    await siyuan.storage.put(path, content);
  },
  async list(dir) {
    try {
      return (await siyuan.storage.list(dir)).filter((e) => !e.isDir).map((e) => e.name);
    } catch {
      return [];
    }
  },
};

/** This device as SiYuan knows it; the ID is reduced to the characters HLC node IDs allow. */
async function readConf(): Promise<{ device: DeviceInfo; lang: string }> {
  try {
    const res = await siyuan.client.fetch("/api/system/getConf", { method: "POST", body: "{}" });
    const conf = (await res.json())?.data?.conf ?? {};
    const system = conf.system ?? {};
    const lang = String(conf.appearance?.lang ?? "");
    const cleaned = typeof system.id === "string" ? system.id.replace(/[^0-9A-Za-z]/g, "").slice(0, 16) : "";
    if (cleaned) return { device: { deviceId: cleaned, name: String(system.name ?? ""), os: String(system.os ?? siyuan.plugin.platform) }, lang };
  } catch (e) {
    await siyuan.logger.warn("getConf failed, falling back to a random device id", String(e));
  }
  return { device: { deviceId: `r${Math.random().toString(36).slice(2, 12)}`, name: "", os: siyuan.plugin.platform }, lang: "" };
}

function toRpcError(e: unknown): Error {
  if (e instanceof ValidationError) {
    const data: RpcErrorData = { kind: "validation", errors: e.errors };
    return new Error(JSON.stringify(data));
  }
  if (e instanceof NotFoundError) {
    const data: RpcErrorData = { kind: "not-found", errors: [e.message] };
    return new Error(JSON.stringify(data));
  }
  return e instanceof Error ? e : new Error(String(e));
}

let engine: StillEngine;
const timers: unknown[] = [];
/** Last seen shape of the storage directories, to notice edits made elsewhere. */
let fingerprint = "";
const unwatched = new Set(WATCHED);

async function readFingerprint(): Promise<string> {
  const parts: string[] = [];
  for (const dir of WATCHED) {
    try {
      for (const e of await siyuan.storage.list(dir)) if (!e.isDir) parts.push(`${dir}/${e.name}@${e.updated}`);
    } catch {
      // directory not created yet
    }
  }
  return parts.sort().join("|");
}

/** Tells the engine if storage differs from the last known state. */
async function detectExternalChange() {
  const next = await readFingerprint();
  if (next === fingerprint) return;
  fingerprint = next;
  await engine.externalChange();
}

/** Watches storage directories where the platform supports it (not on mobile). */
async function watchStorage() {
  for (const dir of [...unwatched]) {
    try {
      await siyuan.storage.watcher.add(dir);
      unwatched.delete(dir);
    } catch {
      // Missing directory or unsupported platform; polling covers it.
    }
  }
}

let fsDebounce: unknown = null;
function onKernelEvent(event: { type: string }) {
  if (event.type !== "fs-notify") return;
  if (fsDebounce) clearTimeout(fsDebounce);
  fsDebounce = setTimeout(() => {
    fsDebounce = null;
    void detectExternalChange();
  }, 400);
}

function createHost(device: DeviceInfo, lang: string): EngineHost {
  return {
    files,
    device,
    http: httpRequest,
    t: translator(lang),
    async emit(event) {
      if (event.type === "changed") await siyuan.rpc.broadcast(RPC.notifyChanged, { source: event.source === "write" ? "rpc" : "storage" });
      else await siyuan.rpc.broadcast(RPC.notifyRemindersDue, { reminders: event.reminders });
    },
    log: {
      warn: (message, detail) => siyuan.logger.warn(message, detail ?? ""),
      error: (message, detail) => siyuan.logger.error(message, detail ?? ""),
    },
    every(ms, fn) {
      const handle = setInterval(fn, ms);
      return () => clearInterval(handle);
    },
    journal,
    async afterWrite() {
      // Our own writes may have just created a directory worth watching.
      if (unwatched.size) await watchStorage();
      fingerprint = await readFingerprint();
    },
  };
}

type Handler = (...args: any[]) => Promise<unknown> | unknown;

function handlers(e: StillEngine): Record<string, Handler> {
  return {
    [RPC.snapshot]: () => e.snapshot(),
    [RPC.createSubscription]: (input: unknown, options?: { settle?: boolean }) => e.createSubscription(input, options),
    [RPC.updateSubscription]: (id: string, input: unknown) => e.updateSubscription(id, input),
    [RPC.deleteSubscription]: (id: string) => e.deleteSubscription(id),
    [RPC.updateSettings]: (patch: unknown) => e.updateSettings(patch),
    [RPC.pendingReminders]: () => e.pendingReminders(),
    [RPC.exportData]: () => e.exportData(),
    [RPC.importData]: (backup: unknown) => e.importData(backup),
    [RPC.getNotifications]: () => e.getNotifications(),
    [RPC.saveNotifications]: (settings: unknown) => e.saveNotifications(settings),
    [RPC.testChannel]: (raw: unknown) => e.testChannel(raw),
    [RPC.deviceInfo]: () => e.deviceInfo(),
    [RPC.listNotebooks]: () => listNotebooks(),
    [RPC.refreshRates]: () => e.refreshRates(true),
    [RPC.claimReminders]: (keys: unknown) => e.claimReminders(keys),
    [RPC.decide]: (subscriptionId: string, chargeDate: unknown, choice: unknown, snoozeUntil?: unknown) => e.decide(subscriptionId, chargeDate, choice, snoozeUntil),
    [RPC.undoDecision]: (subscriptionId: string, chargeDate: unknown, restore?: unknown) => e.undoDecision(subscriptionId, chargeDate, restore),
  };
}

siyuan.plugin.lifecycle.onload = async () => {
  const { device, lang } = await readConf();
  engine = new StillEngine(createHost(device, lang));
  for (const [name, handler] of Object.entries(handlers(engine))) {
    await siyuan.rpc.bind(name, async (...args: unknown[]) => {
      try {
        return await handler(...args);
      } catch (e) {
        throw toRpcError(e);
      }
    });
  }
  siyuan.event.handler = onKernelEvent;
  await registerAgentCapability(() => engine.repo);
};

siyuan.plugin.lifecycle.onrunning = () => {
  // Fire-and-forget: hooks must not block the kernel's startup sequence.
  void (async () => {
    fingerprint = await readFingerprint();
    await watchStorage();
    engine.start();
  })();
  timers.push(
    setInterval(() => {
      void watchStorage();
      void detectExternalChange();
    }, POLL_MS),
  );
};

siyuan.plugin.lifecycle.onunload = () => {
  engine?.stop();
  for (const t of timers.splice(0)) clearInterval(t);
  siyuan.event.handler = null;
};
