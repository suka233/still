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
  validateChannel,
  type FileStore,
  type Snapshot,
  type StillBackup,
} from "@still/core";
import { RPC, type ChannelTestResult, type DecideResult, type DeviceInfo, type ImportResult, type RpcErrorData } from "../shared/rpc.js";
import { registerAgentCapability } from "./agent.js";
import { httpRequest } from "./http.js";
import { Notifier, listNotebooks, sendToChannel, testMessage } from "./notify.js";

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

/** This device as SiYuan knows it; the ID is reduced to the characters HLC node IDs allow. */
async function readDeviceInfo(): Promise<DeviceInfo> {
  try {
    const res = await siyuan.client.fetch("/api/system/getConf", { method: "POST", body: "{}" });
    const system = (await res.json())?.data?.conf?.system ?? {};
    const cleaned = typeof system.id === "string" ? system.id.replace(/[^0-9A-Za-z]/g, "").slice(0, 16) : "";
    if (cleaned) return { deviceId: cleaned, name: String(system.name ?? ""), os: String(system.os ?? siyuan.plugin.platform) };
  } catch (e) {
    await siyuan.logger.warn("getConf failed, falling back to a random device id", String(e));
  }
  return { deviceId: `r${Math.random().toString(36).slice(2, 12)}`, name: "", os: siyuan.plugin.platform };
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
let device: DeviceInfo;
let notifier: Notifier;
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

async function dueState() {
  const [subscriptions, settings, delivered, decisions] = await Promise.all([
    repo.listSubscriptions(),
    repo.getSettings(),
    repo.readDelivered(),
    repo.listDecisions(),
  ]);
  const clock = clockNow();
  const index = indexDecisions(decisions);
  return {
    subscriptions,
    settings,
    clock,
    /** Not yet shown in any window. */
    due: computeDueReminders(subscriptions, settings, clock, delivered, index),
    /** Due regardless of window delivery; push keeps its own log (`push|…`). */
    dueForPush: computeDueReminders(subscriptions, settings, clock, new Set(), index),
  };
}

async function dueReminders() {
  return (await dueState()).due;
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

let ticking = false;
let tickAgain = false;
async function tick(): Promise<void> {
  // Never overlap (a push round can be slow); re-run once if asked meanwhile.
  if (ticking) {
    tickAgain = true;
    return;
  }
  ticking = true;
  void refreshRates();
  try {
    const { due, dueForPush, subscriptions, settings, clock } = await dueState();
    const fresh = due.filter((r) => !announced.has(r.key));
    for (const r of fresh) announced.add(r.key);
    if (fresh.length) await siyuan.rpc.broadcast(RPC.notifyRemindersDue, { reminders: fresh });
    // Push and journal independently of any window being open.
    await notifier.pushReminders(dueForPush, subscriptions);
    await notifier.journalCharges(subscriptions, settings, clock);
  } catch (e) {
    await siyuan.logger.error("reminder tick failed", String(e));
  } finally {
    ticking = false;
    if (tickAgain) {
      tickAgain = false;
      void tick();
    }
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

  [RPC.getNotifications]: () => repo.getNotifications(),

  [RPC.saveNotifications]: (settings: unknown) =>
    exclusive(async () => {
      const saved = await repo.saveNotifications(settings);
      void tick(); // a newly added channel may have reminders waiting
      return saved;
    }),

  [RPC.testChannel]: async (raw: unknown): Promise<ChannelTestResult> => {
    const result = validateChannel(raw);
    if (!result.ok) throw new ValidationError(result.errors);
    return sendToChannel(result.value, testMessage());
  },

  [RPC.deviceInfo]: async () => device,

  [RPC.listNotebooks]: () => listNotebooks(),

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
        void notifier.journalCancellation(subscription);
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
  device = await readDeviceInfo();
  deviceId = device.deviceId;
  repo = new StillRepository({ files, clock: createHlcClock(deviceId) });
  notifier = new Notifier(repo, () => deviceId);
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
  await registerAgentCapability(() => repo);
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
