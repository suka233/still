/**
 * Hybrid logical clock timestamps.
 *
 * Every record carries an `updatedAt` HLC string. Comparing two of them as
 * plain strings orders edits even when device clocks disagree a little, which
 * is what last-writer-wins merging across devices and the sync server needs.
 *
 * Format: `<wall ms, base36, 9 chars>-<counter, base36, 4 chars>-<node>`.
 */

export type Hlc = string;

const WALL_WIDTH = 9;
const COUNTER_WIDTH = 4;
const MAX_COUNTER = 36 ** COUNTER_WIDTH - 1;
const HLC_RE = /^([0-9a-z]{9})-([0-9a-z]{4})-([0-9A-Za-z_]+)$/;

export interface HlcParts {
  wall: number;
  counter: number;
  node: string;
}

export function formatHlc({ wall, counter, node }: HlcParts): Hlc {
  return `${wall.toString(36).padStart(WALL_WIDTH, "0")}-${counter.toString(36).padStart(COUNTER_WIDTH, "0")}-${node}`;
}

export function parseHlc(value: Hlc): HlcParts | null {
  const m = HLC_RE.exec(value);
  if (!m) return null;
  return { wall: parseInt(m[1]!, 36), counter: parseInt(m[2]!, 36), node: m[3]! };
}

export function isHlc(value: unknown): value is Hlc {
  return typeof value === "string" && parseHlc(value) !== null;
}

export interface HlcClock {
  /** A timestamp later than every one this clock has issued or observed. */
  now(): Hlc;
  /** Folds in a timestamp seen from another node so later `now()` sorts after it. */
  observe(remote: Hlc): void;
}

/** `node` must be unique per device and contain only `[0-9A-Za-z_]`. */
export function createHlcClock(node: string, wallClock: () => number = Date.now): HlcClock {
  if (!/^[0-9A-Za-z_]+$/.test(node)) throw new RangeError(`Invalid HLC node id: ${node}`);
  let last: HlcParts = { wall: 0, counter: 0, node };

  return {
    now() {
      const wall = wallClock();
      if (wall > last.wall) {
        last = { wall, counter: 0, node };
      } else if (last.counter < MAX_COUNTER) {
        last = { wall: last.wall, counter: last.counter + 1, node };
      } else {
        last = { wall: last.wall + 1, counter: 0, node };
      }
      return formatHlc(last);
    },
    observe(remote) {
      const parts = parseHlc(remote);
      if (!parts) return;
      if (parts.wall > last.wall || (parts.wall === last.wall && parts.counter > last.counter)) {
        last = { wall: parts.wall, counter: parts.counter, node };
      }
    },
  };
}
