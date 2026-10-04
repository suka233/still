/**
 * Still kernel plugin. Runs inside SiYuan's Go kernel (goja), independently of
 * any open window, and owns all reads and writes of Still's data.
 *
 * The frontend talks to it over JSON-RPC (see `../shared/rpc.ts`); the kernel
 * pushes `changed` and `reminders-due` notifications back.
 */
import {
  NotFoundError,
  PATHS,
  StillRepository,
  ValidationError,
  cancellationEndDate,
  computeDueReminders,
  createHlcClock,
  indexDecisions,
  isLocalDate,
  isStillBackup,
  localDateOf,
  localMinutesOf,
  parseRatesPayload,
  toSubscriptionInput,
  type FileStore,
  type Snapshot,
  type StillBackup,
} from "@still/core";
import { RPC, type DecideResult, type ImportResult, type RpcErrorData } from "../shared/rpc.js";
import { httpRequest } from "./http.js";

/** How often the reminder scheduler wakes up. */
const TICK_MS = 60_000;
/** How often storage is checked for changes made elsewhere (sync, other devices). */
const POLL_MS = 15_000;
/** Exchange rates are refreshed at most this often… */
const RATES_MAX_AGE_MS = 12 * 60 * 60_000;
/** …and after a failed attempt, retried no sooner than this. */
const RATES_RETRY_MS = 60 * 60_000;
/** Tried in order; both are free and need no API key. */
const RATE_SOURCES = [
  { url: "https://open.er-api.com/v6/latest/USD", source: "ExchangeRate-API" },
  { url: "https://api.frankfurter.app/latest?from=USD", source: "Frankfurter (ECB)" },
];
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

/** SiYuan's per-device ID, reduced to the characters HLC node IDs allow. */
async function readDeviceId(): Promise<string> {
  try {
    const res = await siyuan.client.fetch("/api/system/getConf", { method: "POST", body: "{}" });
    const id: unknown = (await res.json())?.data?.conf?.system?.id;
    const cleaned = typeof id === "string" ? id.replace(/[^0-9A-Za-z]/g, "").slice(0, 16) : "";
    if (cleaned) return cleaned;
  } catch (e) {
    await siyuan.logger.warn("getConf failed, falling back to a random device id", String(e));
  }
  return `r${Math.random().toString(36).slice(2, 12)}`;
}

/** Serialises async sections so concurrent RPC calls can't interleave read-modify-write. */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
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

function clockNow() {
  const now = new Date();
  return { today: localDateOf(now), minutes: localMinutesOf(now) };
}

let repo: StillRepository;
let deviceId: string;
const timers: unknown[] = [];
const exclusive = createMutex();
/** Keys already broadcast during this kernel session, so each tick doesn't re-announce them. */
const announced = new Set<string>();
/** Last seen shape of the storage directories, to notice edits made elsewhere. */
let fingerprint = "";
const unwatched = new Set(WATCHED);

async function snapshot(): Promise<Snapshot> {
  const [subscriptions, settings, decisions, rates] = await Promise.all([
    repo.listSubscriptions(),
    repo.getSettings(),
    repo.listDecisions(),
    repo.getRates(),
  ]);
  return { subscriptions, settings, decisions, rates };
}

let lastRatesAttempt = 0;
/** Fetches exchange rates when conversion is on and the cache is stale. */
async function refreshRates(force = false) {
  const now = Date.now();
  if (!force && now - lastRatesAttempt < RATES_RETRY_MS) return;
  const settings = await repo.getSettings();
  if (!settings.convertCurrency && !force) return;
  const cached = await repo.getRates();
  if (!force && cached && now - Date.parse(cached.fetchedAt) < RATES_MAX_AGE_MS) return;
  lastRatesAttempt = now;
  for (const { url, source } of RATE_SOURCES) {
    try {
      const res = await httpRequest({ url, timeoutMs: 8_000 });
      const rates = res.status === 200 ? parseRatesPayload(res.json(), new Date().toISOString(), source) : null;
      if (!rates) continue;
      await exclusive(() => repo.saveRates(rates));
      await changed();
      return;
    } catch (e) {
      await siyuan.logger.warn(`exchange rates from ${source} failed`, String(e));
    }
  }
}

async function dueReminders() {
  const [subscriptions, settings, delivered, decisions] = await Promise.all([
    repo.listSubscriptions(),
    repo.getSettings(),
    repo.readDelivered(),
    repo.listDecisions(),
  ]);
  return computeDueReminders(subscriptions, settings, clockNow(), delivered, indexDecisions(decisions));
}

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

/** Broadcasts `changed` if storage differs from the last known state. */
async function detectExternalChange() {
  const next = await readFingerprint();
  if (next === fingerprint) return;
  fingerprint = next;
  await siyuan.rpc.broadcast(RPC.notifyChanged, { source: "storage" });
  void tick();
}

async function changed() {
  // Our own writes may have just created a directory worth watching.
  if (unwatched.size) await watchStorage();
  fingerprint = await readFingerprint();
  await siyuan.rpc.broadcast(RPC.notifyChanged, { source: "rpc" });
  // Edits can move a charge date into a reminder window right away.
  void tick();
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

async function tick() {
  void refreshRates();
  try {
    const due = await dueReminders();
    const fresh = due.filter((r) => !announced.has(r.key));
    if (fresh.length === 0) return;
    for (const r of fresh) announced.add(r.key);
    await siyuan.rpc.broadcast(RPC.notifyRemindersDue, { reminders: fresh });
  } catch (e) {
    await siyuan.logger.error("reminder tick failed", String(e));
  }
}

type Handler = (...args: any[]) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  [RPC.snapshot]: () => snapshot(),

  [RPC.createSubscription]: (input: unknown) =>
    exclusive(async () => {
      const record = await repo.createSubscription(input);
      await changed();
      return record;
    }),

  [RPC.updateSubscription]: (id: string, input: unknown) =>
    exclusive(async () => {
      const record = await repo.updateSubscription(id, input);
      await changed();
      return record;
    }),

  [RPC.deleteSubscription]: (id: string) =>
    exclusive(async () => {
      await repo.deleteSubscription(id);
      await changed();
      return null;
    }),

  [RPC.updateSettings]: (patch: unknown) =>
    exclusive(async () => {
      const settings = await repo.updateSettings(patch);
      await changed();
      return settings;
    }),

  [RPC.pendingReminders]: () => dueReminders(),

  [RPC.exportData]: async (): Promise<StillBackup> => {
    const [subscriptions, decisions, settings] = await Promise.all([
      repo.listSubscriptions(),
      repo.listDecisions(),
      repo.getSettings(),
    ]);
    return { app: "still", format: 1, exportedAt: new Date().toISOString(), subscriptions, decisions, settings };
  },

  /** Merges a backup record by record; newer edits win on both sides. */
  [RPC.importData]: (backup: unknown) =>
    exclusive(async (): Promise<ImportResult> => {
      if (!isStillBackup(backup)) throw new ValidationError(["not a Still backup file"]);
      const result: ImportResult = { subscriptions: 0, decisions: 0, skipped: 0 };
      for (const s of backup.subscriptions) {
        if (await repo.mergeSubscription(s)) result.subscriptions++;
        else result.skipped++;
      }
      for (const d of backup.decisions) {
        if (await repo.mergeDecision(d)) result.decisions++;
        else result.skipped++;
      }
      await changed();
      return result;
    }),

  [RPC.refreshRates]: async () => {
    await refreshRates(true);
    return repo.getRates();
  },

  /**
   * Marks reminders delivered and returns the subset this caller won. With
   * several windows open, exactly one of them shows each notification.
   */
  [RPC.claimReminders]: (keys: unknown) =>
    exclusive(async () => {
      if (!Array.isArray(keys) || !keys.every((k) => typeof k === "string")) {
        throw new ValidationError(["keys must be an array of strings"]);
      }
      const delivered = await repo.readDelivered();
      const claimed = (keys as string[]).filter((k) => !delivered.has(k));
      if (claimed.length) await repo.markDelivered(deviceId, claimed);
      return claimed;
    }),

  /** Answers "still using it?" for one charge. "cancel" also ends the subscription. */
  [RPC.decide]: (subscriptionId: string, chargeDate: unknown, choice: unknown, snoozeUntil?: unknown) =>
    exclusive(async (): Promise<DecideResult> => {
      const decision = await repo.decide(subscriptionId, chargeDate, choice, snoozeUntil);
      let subscription = (await repo.getSubscription(subscriptionId))!;
      if (decision.choice === "cancel" && subscription.status !== "cancelled") {
        subscription = await repo.updateSubscription(subscriptionId, {
          ...toSubscriptionInput(subscription),
          status: "cancelled",
          endDate: cancellationEndDate(clockNow().today, decision.chargeDate),
        });
      }
      await changed();
      return { decision, subscription };
    }),

  /** Withdraws a decision; `restore` puts the subscription back as it was before. */
  [RPC.undoDecision]: (subscriptionId: string, chargeDate: unknown, restore?: unknown) =>
    exclusive(async () => {
      if (!isLocalDate(chargeDate)) throw new ValidationError(["chargeDate must be a YYYY-MM-DD date"]);
      await repo.clearDecision(subscriptionId, chargeDate);
      const subscription = restore
        ? await repo.updateSubscription(subscriptionId, restore)
        : await repo.getSubscription(subscriptionId);
      await changed();
      return subscription;
    }),
};

siyuan.plugin.lifecycle.onload = async () => {
  deviceId = await readDeviceId();
  repo = new StillRepository({ files, clock: createHlcClock(deviceId) });
  for (const [name, handler] of Object.entries(handlers)) {
    await siyuan.rpc.bind(name, async (...args: unknown[]) => {
      try {
        return await handler(...args);
      } catch (e) {
        throw toRpcError(e);
      }
    });
  }
  siyuan.event.handler = onKernelEvent;
};

siyuan.plugin.lifecycle.onrunning = () => {
  // Fire-and-forget: hooks must not block the kernel's startup sequence.
  void (async () => {
    fingerprint = await readFingerprint();
    await watchStorage();
    await tick();
  })();
  timers.push(setInterval(() => void tick(), TICK_MS));
  timers.push(
    setInterval(() => {
      void watchStorage();
      void detectExternalChange();
    }, POLL_MS),
  );
};

siyuan.plugin.lifecycle.onunload = () => {
  for (const t of timers.splice(0)) clearInterval(t);
  siyuan.event.handler = null;
};
