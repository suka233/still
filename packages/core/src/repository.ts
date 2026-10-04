import { addDays, compareLocalDate, isLocalDate, localDateOf, type LocalDate } from "./date.js";
import { isHlc, type HlcClock } from "./hlc.js";
import { randomUuid } from "./id.js";
import {
  DECISION_CHOICES,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  decisionId,
  validateSettingsPatch,
  validateSubscriptionInput,
  type Decision,
  type DecisionChoice,
  type Settings,
  type Subscription,
} from "./model.js";
import type { ExchangeRates } from "./rates.js";
import { chargeDateOfKey } from "./reminders.js";

/**
 * Minimal file access the repository needs. Hosts implement it on top of their
 * own storage (SiYuan petal storage, Obsidian vault adapter, a server disk…).
 */
export interface FileStore {
  /** File contents, or `null` when the file does not exist. */
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  /** Names of the files (not directories) directly inside `dir`; empty if missing. */
  list(dir: string): Promise<string[]>;
}

/**
 * Layout. One file per subscription makes file-level sync (SiYuan's, or any
 * folder sync) behave like per-record last-writer-wins instead of clobbering
 * the whole list when two devices edit different subscriptions.
 */
export const PATHS = {
  subscriptionsDir: "subscriptions",
  subscription: (id: string) => `subscriptions/${id}.json`,
  settings: "settings.json",
  deliveredDir: "delivered",
  delivered: (deviceId: string) => `delivered/${deviceId}.json`,
  decisionsDir: "decisions",
  decision: (id: string) => `decisions/${id}.json`,
  rates: "rates.json",
} as const;

/** Delivery records are kept this long after their charge date. */
const DELIVERED_RETENTION_DAYS = 400;

export class ValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Subscription not found: ${id}`);
    this.name = "NotFoundError";
  }
}

interface DeliveredFile {
  schemaVersion: number;
  /** reminder key → ISO instant it was delivered */
  keys: Record<string, string>;
}

export interface RepositoryOptions {
  files: FileStore;
  clock: HlcClock;
  now?: () => Date;
  random?: () => number;
}

export class StillRepository {
  readonly #files: FileStore;
  readonly #clock: HlcClock;
  readonly #now: () => Date;
  readonly #random: () => number;

  constructor({ files, clock, now = () => new Date(), random = Math.random }: RepositoryOptions) {
    this.#files = files;
    this.#clock = clock;
    this.#now = now;
    this.#random = random;
  }

  async listSubscriptions({ includeDeleted = false } = {}): Promise<Subscription[]> {
    const names = await this.#files.list(PATHS.subscriptionsDir);
    const records = await Promise.all(
      names.filter((n) => n.endsWith(".json")).map((n) => this.#readSubscription(`${PATHS.subscriptionsDir}/${n}`)),
    );
    return records.filter((r): r is Subscription => r !== null && (includeDeleted || !r.deletedAt));
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    const record = await this.#readSubscription(PATHS.subscription(id));
    return record && !record.deletedAt ? record : null;
  }

  async createSubscription(input: unknown): Promise<Subscription> {
    const result = validateSubscriptionInput(input);
    if (!result.ok) throw new ValidationError(result.errors);
    const record: Subscription = {
      ...result.value,
      id: randomUuid(this.#random),
      schemaVersion: SCHEMA_VERSION,
      createdAt: this.#now().toISOString(),
      updatedAt: this.#clock.now(),
      deletedAt: null,
    };
    await this.#writeSubscription(record);
    return record;
  }

  async updateSubscription(id: string, input: unknown): Promise<Subscription> {
    const existing = await this.getSubscription(id);
    if (!existing) throw new NotFoundError(id);
    const result = validateSubscriptionInput(input);
    if (!result.ok) throw new ValidationError(result.errors);
    const record: Subscription = {
      ...result.value,
      id,
      schemaVersion: SCHEMA_VERSION,
      createdAt: existing.createdAt,
      updatedAt: this.#clock.now(),
      deletedAt: null,
    };
    await this.#writeSubscription(record);
    return record;
  }

  /** Soft delete: the tombstone stays on disk so the deletion propagates through sync. */
  async deleteSubscription(id: string): Promise<void> {
    const existing = await this.getSubscription(id);
    if (!existing) throw new NotFoundError(id);
    await this.#writeSubscription({ ...existing, updatedAt: this.#clock.now(), deletedAt: this.#now().toISOString() });
  }

  async getSettings(): Promise<Settings> {
    const raw = await this.#readJson(PATHS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const result = validateSettingsPatch(raw, DEFAULT_SETTINGS);
    const settings = result.ok ? result.value : { ...DEFAULT_SETTINGS };
    const updatedAt = (raw as Record<string, unknown>).updatedAt;
    settings.updatedAt = isHlc(updatedAt) ? updatedAt : null;
    if (settings.updatedAt) this.#clock.observe(settings.updatedAt);
    return settings;
  }

  async updateSettings(patch: unknown): Promise<Settings> {
    const result = validateSettingsPatch(patch, await this.getSettings());
    if (!result.ok) throw new ValidationError(result.errors);
    const settings = { ...result.value, updatedAt: this.#clock.now() };
    await this.#files.write(PATHS.settings, JSON.stringify(settings, null, 2));
    return settings;
  }

  /** Reminder keys delivered on any device (each device writes its own file). */
  async readDelivered(): Promise<Set<string>> {
    const names = await this.#files.list(PATHS.deliveredDir);
    const keys = new Set<string>();
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const file = await this.#readJson(`${PATHS.deliveredDir}/${name}`);
      const map = (file as DeliveredFile | null)?.keys;
      if (map && typeof map === "object") for (const key of Object.keys(map)) keys.add(key);
    }
    return keys;
  }

  async markDelivered(deviceId: string, keys: readonly string[]): Promise<void> {
    if (!/^[0-9A-Za-z_-]+$/.test(deviceId)) throw new RangeError(`Invalid device id: ${deviceId}`);
    const path = PATHS.delivered(deviceId);
    const existing = ((await this.#readJson(path)) as DeliveredFile | null)?.keys ?? {};
    const now = this.#now();
    const cutoff = addDays(localDateOf(now), -DELIVERED_RETENTION_DAYS);
    const next: Record<string, string> = {};
    for (const [key, at] of Object.entries(existing)) {
      const chargeDate = chargeDateOfKey(key);
      if (chargeDate && compareLocalDate(chargeDate, cutoff) >= 0) next[key] = at;
    }
    for (const key of keys) next[key] ??= now.toISOString();
    const file: DeliveredFile = { schemaVersion: SCHEMA_VERSION, keys: next };
    await this.#files.write(path, JSON.stringify(file));
  }

  async listDecisions({ includeDeleted = false } = {}): Promise<Decision[]> {
    const names = await this.#files.list(PATHS.decisionsDir);
    const records = await Promise.all(
      names.filter((n) => n.endsWith(".json")).map(async (n) => migrateDecision(await this.#readJson(`${PATHS.decisionsDir}/${n}`))),
    );
    const live = records.filter((r): r is Decision => r !== null && (includeDeleted || !r.deletedAt));
    for (const r of live) this.#clock.observe(r.updatedAt);
    return live;
  }

  /** Records the answer for one charge, replacing any earlier answer for it. */
  async decide(subscriptionId: string, chargeDate: unknown, choice: unknown, snoozeUntil?: unknown): Promise<Decision> {
    const errors: string[] = [];
    if (!isLocalDate(chargeDate)) errors.push("chargeDate must be a YYYY-MM-DD date");
    if (!DECISION_CHOICES.includes(choice as DecisionChoice)) errors.push("choice must be keep, cancel or snooze");
    if (choice === "snooze" && !isLocalDate(snoozeUntil)) errors.push("snoozeUntil must be a YYYY-MM-DD date");
    if (errors.length) throw new ValidationError(errors);
    if (!(await this.getSubscription(subscriptionId))) throw new NotFoundError(subscriptionId);
    const record: Decision = {
      id: decisionId(subscriptionId, chargeDate as LocalDate),
      subscriptionId,
      chargeDate: chargeDate as LocalDate,
      choice: choice as DecisionChoice,
      snoozeUntil: choice === "snooze" ? (snoozeUntil as LocalDate) : null,
      decidedAt: this.#now().toISOString(),
      updatedAt: this.#clock.now(),
      deletedAt: null,
      schemaVersion: SCHEMA_VERSION,
    };
    await this.#files.write(PATHS.decision(record.id), JSON.stringify(record, null, 2));
    return record;
  }

  /** Withdraws the answer for one charge (used by undo); a no-op if there is none. */
  async clearDecision(subscriptionId: string, chargeDate: LocalDate): Promise<void> {
    const id = decisionId(subscriptionId, chargeDate);
    const existing = migrateDecision(await this.#readJson(PATHS.decision(id)));
    if (!existing || existing.deletedAt) return;
    const tombstone: Decision = { ...existing, updatedAt: this.#clock.now(), deletedAt: this.#now().toISOString() };
    await this.#files.write(PATHS.decision(id), JSON.stringify(tombstone, null, 2));
  }

  /**
   * Last-writer-wins merge of a record from elsewhere (import, sync server).
   * Returns true when the incoming record replaced the local one.
   */
  async mergeSubscription(raw: unknown): Promise<boolean> {
    const incoming = migrateSubscription(raw);
    if (!incoming) return false;
    const local = await this.#readSubscription(PATHS.subscription(incoming.id));
    this.#clock.observe(incoming.updatedAt);
    if (local && local.updatedAt >= incoming.updatedAt) return false;
    await this.#writeSubscription(incoming);
    return true;
  }

  async mergeDecision(raw: unknown): Promise<boolean> {
    const incoming = migrateDecision(raw);
    if (!incoming) return false;
    const local = migrateDecision(await this.#readJson(PATHS.decision(incoming.id)));
    this.#clock.observe(incoming.updatedAt);
    if (local && local.updatedAt >= incoming.updatedAt) return false;
    await this.#files.write(PATHS.decision(incoming.id), JSON.stringify(incoming, null, 2));
    return true;
  }

  async getRates(): Promise<ExchangeRates | null> {
    const raw = (await this.#readJson(PATHS.rates)) as ExchangeRates | null;
    return raw && typeof raw.base === "string" && raw.rates && typeof raw.fetchedAt === "string" ? raw : null;
  }

  async saveRates(rates: ExchangeRates): Promise<void> {
    await this.#files.write(PATHS.rates, JSON.stringify(rates));
  }

  async #readJson(path: string): Promise<unknown> {
    const text = await this.#files.read(path);
    if (text === null || text === "") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async #readSubscription(path: string): Promise<Subscription | null> {
    const raw = await this.#readJson(path);
    const record = migrateSubscription(raw);
    if (record) this.#clock.observe(record.updatedAt);
    return record;
  }

  async #writeSubscription(record: Subscription): Promise<void> {
    await this.#files.write(PATHS.subscription(record.id), JSON.stringify(record, null, 2));
  }
}

/** Upgrades a stored record to the current schema; `null` if unreadable. */
export function migrateSubscription(raw: unknown): Subscription | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !isHlc(r.updatedAt) || typeof r.createdAt !== "string") return null;
  if (typeof r.schemaVersion === "number" && r.schemaVersion > SCHEMA_VERSION) {
    // Written by a newer client; keep it readable but don't drop unknown fields on write.
    return r as unknown as Subscription;
  }
  if (r.deletedAt) return r as unknown as Subscription;
  const result = validateSubscriptionInput(r);
  if (!result.ok) return null;
  return {
    ...result.value,
    id: r.id,
    schemaVersion: SCHEMA_VERSION,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  };
}

export function migrateDecision(raw: unknown): Decision | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.subscriptionId !== "string" ||
    !isLocalDate(r.chargeDate) ||
    !DECISION_CHOICES.includes(r.choice as DecisionChoice) ||
    !isHlc(r.updatedAt)
  ) {
    return null;
  }
  return {
    id: r.id,
    subscriptionId: r.subscriptionId,
    chargeDate: r.chargeDate,
    choice: r.choice as DecisionChoice,
    snoozeUntil: isLocalDate(r.snoozeUntil) ? r.snoozeUntil : null,
    decidedAt: typeof r.decidedAt === "string" ? r.decidedAt : "",
    updatedAt: r.updatedAt,
    deletedAt: typeof r.deletedAt === "string" ? r.deletedAt : null,
    schemaVersion: typeof r.schemaVersion === "number" ? r.schemaVersion : SCHEMA_VERSION,
  };
}

/** Portable backup format written by "Export" and accepted by "Import". */
export interface StillBackup {
  app: "still";
  format: 1;
  exportedAt: string;
  subscriptions: Subscription[];
  decisions: Decision[];
  settings: Settings;
}

export function isStillBackup(value: unknown): value is StillBackup {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.app === "still" && v.format === 1 && Array.isArray(v.subscriptions) && Array.isArray(v.decisions);
}
