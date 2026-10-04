import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  StillRepository,
  ValidationError,
  chargesBetween,
  computeDueReminders,
  createHlcClock,
  formatMoneyAmount,
  monthlyTotals,
  parseMoneyInput,
  upcomingCharges,
  validateSubscriptionInput,
  type FileStore,
  type Subscription,
  type SubscriptionInput,
} from "../src/index.js";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
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
  };
}

const at = (today: string, time = "12:00") => ({
  today,
  minutes: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
});

describe("money", () => {
  it("parses decimal input without floating point error", () => {
    expect(parseMoneyInput("9.99", "USD")).toEqual({ amount: 999, currency: "USD" });
    expect(parseMoneyInput("0.1", "USD")).toEqual({ amount: 10, currency: "USD" });
    expect(parseMoneyInput("12,5", "EUR")).toEqual({ amount: 1250, currency: "EUR" });
    expect(parseMoneyInput("1280", "JPY")).toEqual({ amount: 1280, currency: "JPY" });
    expect(parseMoneyInput("1.5", "JPY")).toBeNull();
    expect(parseMoneyInput("-1", "USD")).toBeNull();
  });

  it("formats minor units", () => {
    expect(formatMoneyAmount({ amount: 5, currency: "USD" })).toBe("0.05");
    expect(formatMoneyAmount({ amount: 1500, currency: "JPY" })).toBe("1500");
    expect(formatMoneyAmount({ amount: 1234, currency: "KWD" })).toBe("1.234");
  });
});

describe("reminders", () => {
  it("fires the threshold once it is reached", () => {
    const subs = [sub()];
    expect(computeDueReminders(subs, DEFAULT_SETTINGS, at("2026-10-06"), new Set())).toEqual([]);
    const [r] = computeDueReminders(subs, DEFAULT_SETTINGS, at("2026-10-07"), new Set());
    expect(r).toMatchObject({ key: "s1:2026-10-10:3", kind: "renewal", daysLeft: 3, threshold: 3 });
  });

  it("waits until notifyAt on the threshold day", () => {
    const subs = [sub()];
    expect(computeDueReminders(subs, DEFAULT_SETTINGS, at("2026-10-07", "08:59"), new Set())).toEqual([]);
    expect(computeDueReminders(subs, DEFAULT_SETTINGS, at("2026-10-07", "09:00"), new Set())).toHaveLength(1);
  });

  it("collapses missed thresholds into the most urgent one", () => {
    const [r] = computeDueReminders([sub()], DEFAULT_SETTINGS, at("2026-10-09"), new Set());
    expect(r).toMatchObject({ threshold: 1, daysLeft: 1 });
  });

  it("skips delivered keys but still fires the next threshold", () => {
    const delivered = new Set(["s1:2026-10-10:3"]);
    expect(computeDueReminders([sub()], DEFAULT_SETTINGS, at("2026-10-08"), delivered)).toEqual([]);
    expect(computeDueReminders([sub()], DEFAULT_SETTINGS, at("2026-10-09"), delivered)).toHaveLength(1);
  });

  it("uses trial thresholds for the conversion charge only", () => {
    const trial = sub({ trialEndsOn: "2026-10-10", anchorDate: "2026-10-10", remindDaysBefore: [0] });
    const settings = { ...DEFAULT_SETTINGS, trialRemindDaysBefore: [5] };
    const [r] = computeDueReminders([trial], settings, at("2026-10-05"), new Set());
    expect(r).toMatchObject({ kind: "trial-ending", threshold: 5 });
    const [later] = computeDueReminders([trial], settings, at("2026-11-10"), new Set());
    expect(later).toMatchObject({ kind: "renewal", chargeDate: "2026-11-10", threshold: 0 });
  });

  it("ignores paused, cancelled, deleted and ended subscriptions", () => {
    const subs = [
      sub({ id: "a", status: "paused" }),
      sub({ id: "b", status: "cancelled" }),
      sub({ id: "c", deletedAt: "2026-01-02T00:00:00Z" }),
      sub({ id: "d", endDate: "2026-10-09" }),
    ];
    expect(computeDueReminders(subs, DEFAULT_SETTINGS, at("2026-10-09"), new Set())).toEqual([]);
  });
});

describe("summaries", () => {
  const subs = [
    sub({ id: "a", name: "B", price: { amount: 12000, currency: "CNY" }, cycle: { unit: "year", every: 1 }, anchorDate: "2026-03-01" }),
    sub({ id: "b", name: "A", price: { amount: 1500, currency: "CNY" }, anchorDate: "2026-01-15" }),
    sub({ id: "c", name: "C", price: { amount: 999, currency: "USD" }, status: "paused" }),
  ];

  it("totals monthly spend per currency", () => {
    expect(monthlyTotals(subs, "2026-10-04")).toEqual({ CNY: 2500 });
  });

  it("lists upcoming charges soonest first", () => {
    expect(upcomingCharges(subs, "2026-10-04").map((u) => [u.subscription.id, u.chargeDate])).toEqual([
      ["b", "2026-10-15"],
      ["a", "2027-03-01"],
    ]);
  });

  it("sums the charges in a window", () => {
    expect(chargesBetween(subs, "2026-10-01", "2026-12-31")).toEqual({ CNY: 4500 });
  });
});

describe("HLC", () => {
  it("is monotonic and sorts as a string", () => {
    let wall = 1000;
    const clock = createHlcClock("dev1", () => wall);
    const a = clock.now();
    const b = clock.now();
    wall = 999; // clock went backwards
    const c = clock.now();
    expect(a < b && b < c).toBe(true);
  });

  it("moves past observed remote timestamps", () => {
    const clock = createHlcClock("dev1", () => 1000);
    const remote = createHlcClock("dev2", () => 5000).now();
    clock.observe(remote);
    expect(clock.now() > remote).toBe(true);
  });
});

function memoryFiles(): FileStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
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

describe("repository", () => {
  const input: SubscriptionInput = {
    name: "  Spotify ",
    status: "active",
    price: { amount: 1099, currency: "EUR" },
    cycle: { unit: "month", every: 1 },
    anchorDate: "2026-02-03",
  };

  function repo() {
    const files = memoryFiles();
    let n = 0;
    const repository = new StillRepository({
      files,
      clock: createHlcClock("test", () => 1_700_000_000_000 + n++),
      now: () => new Date("2026-10-04T10:00:00Z"),
    });
    return { files, repository };
  }

  it("creates, updates and soft-deletes", async () => {
    const { files, repository } = repo();
    const created = await repository.createSubscription(input);
    expect(created.name).toBe("Spotify");
    expect(files.data.has(`subscriptions/${created.id}.json`)).toBe(true);

    const updated = await repository.updateSubscription(created.id, { ...input, name: "Spotify Duo" });
    expect(updated.updatedAt > created.updatedAt).toBe(true);
    expect(updated.createdAt).toBe(created.createdAt);

    await repository.deleteSubscription(created.id);
    expect(await repository.listSubscriptions()).toEqual([]);
    const [tombstone] = await repository.listSubscriptions({ includeDeleted: true });
    expect(tombstone?.deletedAt).toBeTruthy();
  });

  it("rejects invalid input", async () => {
    const { repository } = repo();
    await expect(repository.createSubscription({ ...input, anchorDate: "2026-02-30" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("merges delivery records from every device and prunes old ones", async () => {
    const { files, repository } = repo();
    files.data.set("delivered/old.json", JSON.stringify({ schemaVersion: 1, keys: { "x:2020-01-01:1": "t", "y:2026-10-05:1": "t" } }));
    await repository.markDelivered("dev1", ["s1:2026-10-10:3"]);
    await repository.markDelivered("old", []);
    expect([...(await repository.readDelivered())].sort()).toEqual(["s1:2026-10-10:3", "y:2026-10-05:1"]);
  });

  it("validates settings", async () => {
    const { repository } = repo();
    const settings = await repository.updateSettings({ notifyAt: "20:30", remindDaysBefore: [1, 7, 1] });
    expect(settings).toMatchObject({ notifyAt: "20:30", remindDaysBefore: [7, 1] });
    expect((await repository.getSettings()).updatedAt).toBe(settings.updatedAt);
    await expect(repository.updateSettings({ notifyAt: "25:00" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("validation", () => {
  it("rejects a trial that ends after the first charge", () => {
    const result = validateSubscriptionInput({
      name: "X",
      price: { amount: 1, currency: "USD" },
      cycle: { unit: "month", every: 1 },
      anchorDate: "2026-10-01",
      trialEndsOn: "2026-10-02",
    });
    expect(result.ok).toBe(false);
  });
});
