/**
 * Still kernel plugin. Runs inside SiYuan's Go kernel (goja), independently of
 * any open window, and owns all reads and writes of Still's data.
 *
 * The frontend talks to it over JSON-RPC (see `../shared/rpc.ts`); the kernel
 * pushes `changed` and `reminders-due` notifications back.
 */
import {
  NotFoundError,
  StillRepository,
  ValidationError,
  computeDueReminders,
  createHlcClock,
  localDateOf,
  localMinutesOf,
  type FileStore,
  type Snapshot,
} from "@still/core";
import { RPC, type RpcErrorData } from "../shared/rpc.js";

/** How often the reminder scheduler wakes up. */
const TICK_MS = 60_000;

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
let timer: unknown = null;
const exclusive = createMutex();
/** Keys already broadcast during this kernel session, so each tick doesn't re-announce them. */
const announced = new Set<string>();

async function snapshot(): Promise<Snapshot> {
  const [subscriptions, settings] = await Promise.all([repo.listSubscriptions(), repo.getSettings()]);
  return { subscriptions, settings };
}

async function dueReminders() {
  const [subscriptions, settings, delivered] = await Promise.all([
    repo.listSubscriptions(),
    repo.getSettings(),
    repo.readDelivered(),
  ]);
  return computeDueReminders(subscriptions, settings, clockNow(), delivered);
}

async function changed() {
  await siyuan.rpc.broadcast(RPC.notifyChanged, {});
  // Edits can move a charge date into a reminder window right away.
  void tick();
}

async function tick() {
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
};

siyuan.plugin.lifecycle.onrunning = () => {
  // Fire-and-forget: hooks must not block the kernel's startup sequence.
  void tick();
  timer = setInterval(() => void tick(), TICK_MS);
};

siyuan.plugin.lifecycle.onunload = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
