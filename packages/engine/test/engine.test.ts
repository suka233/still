import type { FileStore } from "@still/core";
import { describe, expect, it } from "vitest";
import { StillEngine, createTranslator, httpResponse, messagesFor, type EngineEvent, type EngineHost, type HttpRequest } from "../src/index.js";

function memoryFiles(): FileStore {
  const data = new Map<string, string>();
  return {
    async read(path) {
      return data.get(path) ?? null;
    },
    async write(path, content) {
      data.set(path, content);
    },
    async list(dir) {
      const prefix = `${dir}/`;
      return [...data.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length));
    },
  };
}

/** A host with in-memory storage, a fixed clock (2026-10-04 10:00) and recorded side effects. */
function testHost(files = memoryFiles(), deviceId = "dev1") {
  const events: EngineEvent[] = [];
  const requests: HttpRequest[] = [];
  const journal: string[] = [];
  const host: EngineHost = {
    files,
    device: { deviceId, name: "test", os: "test" },
    async http(req) {
      requests.push(req);
      return httpResponse(200, "{}");
    },
    t: createTranslator(messagesFor("en")),
    emit: (e) => void events.push(e),
    log: { warn() {}, error() {} },
    every: () => () => {},
    journal: { canWrite: () => true, append: async (_s, line) => (journal.push(line), true) },
    now: () => new Date(2026, 9, 4, 10, 0),
  };
  return { host, events, requests, journal, files };
}

// The engine compiles without DOM or Node types; tests just need a timer.
declare function setTimeout(callback: () => void, ms: number): unknown;

/** Writes start a background tick; let it (and a re-run it may schedule) finish. */
const settle = () => new Promise<void>((r) => setTimeout(() => r(), 20));

const netflix = { name: "Netflix", status: "active", price: { amount: 1549, currency: "USD" }, cycle: { unit: "month", every: 1 }, anchorDate: "2026-09-05" };

describe("StillEngine", () => {
  it("settles a new subscription whose charge is already inside the reminder window", async () => {
    const { host } = testHost();
    const engine = new StillEngine(host);
    await engine.updateSettings({ convertCurrency: false });
    await engine.createSubscription(netflix); // next charge 2026-10-05, i.e. tomorrow
    expect(await engine.pendingReminders()).toEqual([]);
    const { decisions } = await engine.snapshot();
    expect(decisions.map((d) => [d.chargeDate, d.choice])).toEqual([["2026-10-05", "keep"]]);
  });

  it("announces due reminders once, and exactly one claimer wins each", async () => {
    const { host, events } = testHost();
    const engine = new StillEngine(host);
    await engine.updateSettings({ convertCurrency: false });
    await engine.createSubscription(netflix, { settle: false });
    await settle();
    await engine.tick();
    const due = events.filter((e) => e.type === "reminders-due");
    expect(due).toHaveLength(1);
    const keys = (due[0] as Extract<EngineEvent, { type: "reminders-due" }>).reminders.map((r) => r.key);
    expect(await engine.claimReminders(keys)).toEqual(keys);
    expect(await engine.claimReminders(keys)).toEqual([]);
    expect(await engine.pendingReminders()).toEqual([]);
  });

  it("cancelling ends the subscription and notes it in the daily note", async () => {
    const { host, journal } = testHost();
    const engine = new StillEngine(host);
    await engine.updateSettings({ convertCurrency: false });
    await engine.saveNotifications({ channels: [], sender: "any", journal: { enabled: true, notebookId: null } });
    const sub = await engine.createSubscription(netflix, { settle: false });
    const { subscription } = await engine.decide(sub.id, "2026-10-05", "cancel");
    expect(subscription.status).toBe("cancelled");
    await settle();
    expect(journal).toEqual(["✂️ Decided not to renew Netflix (saves $15.49 per charge)"]);
  });

  it("pushes each due reminder once through enabled channels, only from the sender device", async () => {
    const files = memoryFiles();
    const a = testHost(files, "devA");
    const b = testHost(files, "devB");
    const engineA = new StillEngine(a.host);
    const engineB = new StillEngine(b.host);
    await engineA.updateSettings({ convertCurrency: false });
    await engineA.saveNotifications({ channels: [{ id: "c1", kind: "ntfy", name: "", enabled: true, config: { topic: "t" } }], sender: "devA", journal: { enabled: false, notebookId: null } });
    await engineA.createSubscription(netflix, { settle: false });
    await settle();
    await engineB.tick();
    expect(b.requests).toHaveLength(0);
    await engineA.tick();
    const pushes = a.requests.filter((r) => r.url === "https://ntfy.sh");
    expect(pushes).toHaveLength(1);
    expect(pushes[0]!.json).toMatchObject({ topic: "t", title: "Netflix renews tomorrow" });
  });

  it("emits changed after writes and on external changes", async () => {
    const { host, events } = testHost();
    let wrote = 0;
    host.afterWrite = async () => void wrote++;
    const engine = new StillEngine(host);
    await engine.updateSettings({ notifyAt: "08:30" });
    await engine.externalChange();
    expect(wrote).toBe(1);
    expect(events.filter((e) => e.type === "changed").map((e) => (e as { source: string }).source)).toEqual(["write", "storage"]);
  });

  it("rejects malformed calls with validation errors", async () => {
    const engine = new StillEngine(testHost().host);
    await expect(engine.claimReminders("nope")).rejects.toMatchObject({ errors: ["keys must be an array of strings"] });
    await expect(engine.importData({})).rejects.toMatchObject({ errors: ["not a Still backup file"] });
  });
});
