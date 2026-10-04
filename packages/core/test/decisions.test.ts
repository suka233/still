import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  StillRepository,
  computeDueReminders,
  createHlcClock,
  decisionId,
  estimatePaid,
  estimateSaved,
  indexDecisions,
  pendingDecisions,
  snoozeOptions,
  type Decision,
  type DecisionChoice,
  type FileStore,
  type Subscription,
} from "../src/index.js";

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "s1",
  name: "Netflix",
  status: "active",
  price: { amount: 1599, currency: "USD" },
  cycle: { unit: "month", every: 1 },
  anchorDate: "2026-01-10",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "000000000-0000-a",
  ...overrides,
});

const at = (today: string, minutes = 12 * 60) => ({ today, minutes });

function decision(choice: DecisionChoice, chargeDate = "2026-10-10", snoozeUntil: string | null = null): Decision {
  return {
    id: decisionId("s1", chargeDate),
    subscriptionId: "s1",
    chargeDate,
    choice,
    snoozeUntil,
    decidedAt: "",
    updatedAt: "000000001-0000-a",
    schemaVersion: 1,
  };
}

const due = (today: string, decisions: Decision[], delivered: string[] = []) =>
  computeDueReminders([sub()], DEFAULT_SETTINGS, at(today), new Set(delivered), indexDecisions(decisions));

describe("decisions silence reminders", () => {
  it("keep and cancel silence the rest of that charge only", () => {
    for (const choice of ["keep", "cancel"] as const) {
      expect(due("2026-10-09", [decision(choice)])).toEqual([]);
      expect(due("2026-11-07", [decision(choice)])).toHaveLength(1); // next month asks again
    }
  });

  it("a snooze waits, fires once, then later thresholds resume", () => {
    const d = [decision("snooze", "2026-10-10", "2026-10-08")];
    expect(due("2026-10-07", d)).toEqual([]);
    const [r] = due("2026-10-08", d);
    expect(r).toMatchObject({ key: "s1:2026-10-10:s2026-10-08", threshold: null, daysLeft: 2 });
    expect(due("2026-10-08", d, [r!.key])).toEqual([]);
    expect(due("2026-10-09", d, [r!.key])[0]).toMatchObject({ key: "s1:2026-10-10:t1", threshold: 1 });
  });

  it("tombstoned decisions are ignored", () => {
    expect(due("2026-10-09", [{ ...decision("keep"), deletedAt: "x" }])).toHaveLength(1);
  });
});

describe("pending decisions", () => {
  const pending = (today: string, decisions: Decision[], minutes?: number) =>
    pendingDecisions([sub()], DEFAULT_SETTINGS, at(today, minutes), indexDecisions(decisions));

  it("lists asked-but-unanswered charges until answered", () => {
    expect(pending("2026-10-06", [])).toEqual([]);
    expect(pending("2026-10-07", [], 8 * 60)).toEqual([]);
    expect(pending("2026-10-07", [])).toMatchObject([{ chargeDate: "2026-10-10", daysLeft: 3 }]);
    expect(pending("2026-10-07", [decision("keep")])).toEqual([]);
  });

  it("hides snoozed charges until the snooze expires", () => {
    const d = [decision("snooze", "2026-10-10", "2026-10-09")];
    expect(pending("2026-10-08", d)).toEqual([]);
    expect(pending("2026-10-09", d)).toHaveLength(1);
  });
});

describe("snooze options", () => {
  it("never passes the charge date and always offers the day before", () => {
    expect(snoozeOptions("2026-10-01", "2026-10-10").map((o) => o.until)).toEqual(["2026-10-02", "2026-10-04", "2026-10-08", "2026-10-09"]);
    expect(snoozeOptions("2026-10-08", "2026-10-10").map((o) => o.until)).toEqual(["2026-10-09"]);
    expect(snoozeOptions("2026-10-09", "2026-10-10").map((o) => o.until)).toEqual(["2026-10-10"]);
    expect(snoozeOptions("2026-10-10", "2026-10-10")).toEqual([]);
  });
});

describe("spend estimates", () => {
  it("counts charges from the anchor to today or the end of service", () => {
    expect(estimatePaid(sub(), "2026-10-04")).toEqual({ count: 9, amount: 9 * 1599 });
    expect(estimatePaid(sub(), "2026-01-09")).toEqual({ count: 0, amount: 0 });
    expect(estimatePaid(sub({ endDate: "2026-03-09" }), "2026-10-04").count).toBe(2);
  });

  it("adds up charges avoided by cancel decisions", () => {
    const cancelled = sub({ status: "cancelled", endDate: "2026-10-09" });
    expect(estimateSaved([cancelled], [decision("cancel")], "2026-10-09")).toEqual({ totals: {}, cancelled: 1 });
    expect(estimateSaved([cancelled], [decision("cancel")], "2026-11-10")).toEqual({ totals: { USD: 3198 }, cancelled: 1 });
    expect(estimateSaved([sub()], [decision("cancel")], "2026-11-10").cancelled).toBe(0); // re-activated
  });
});

describe("repository decisions", () => {
  function files(): FileStore {
    const data = new Map<string, string>();
    return {
      read: async (p) => data.get(p) ?? null,
      write: async (p, c) => void data.set(p, c),
      list: async (dir) => [...data.keys()].filter((k) => k.startsWith(`${dir}/`)).map((k) => k.slice(dir.length + 1)),
    };
  }

  it("upserts one record per charge and supports undo", async () => {
    let n = 0;
    const repo = new StillRepository({ files: files(), clock: createHlcClock("t", () => 1e12 + n++) });
    const s = await repo.createSubscription({
      name: "X",
      price: { amount: 100, currency: "USD" },
      cycle: { unit: "month", every: 1 },
      anchorDate: "2026-10-10",
    });
    await repo.decide(s.id, "2026-10-10", "snooze", "2026-10-08");
    await repo.decide(s.id, "2026-10-10", "keep");
    const [only] = await repo.listDecisions();
    expect((await repo.listDecisions()).length).toBe(1);
    expect(only).toMatchObject({ choice: "keep", snoozeUntil: null });
    await repo.clearDecision(s.id, "2026-10-10");
    expect(await repo.listDecisions()).toEqual([]);
    await expect(repo.decide(s.id, "2026-10-10", "snooze")).rejects.toThrow(/snoozeUntil/);
    await expect(repo.decide("missing", "2026-10-10", "keep")).rejects.toThrow(/not found/);
  });
});
