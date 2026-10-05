import { useEffect, useRef, useState } from "react";

/**
 * Small motion helpers. Motion is feedback, never decoration: it plays when
 * something happens (an answer, a total changing, the first open) and every
 * helper collapses to "instant" under prefers-reduced-motion.
 */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}

const entered = new Set<string>();

/** True on the first mount of `key` in this session (e.g. the dock's entrance), false afterwards. */
export function useFirstEntrance(key: string, ms = 700): boolean {
  const [on, setOn] = useState(() => !entered.has(key) && !reducedMotion());
  useEffect(() => {
    entered.add(key);
    if (!on) return;
    const timer = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(timer);
  }, [key, ms, on]);
  return on;
}

/**
 * Per-currency totals that roll to their new value instead of jumping. The first
 * value is shown as is; later changes ease out over `ms`.
 */
export function useTweenedTotals(target: Record<string, number>, ms = 650): Record<string, number> {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const signature = JSON.stringify(target);
  useEffect(() => {
    const start = from.current;
    if (JSON.stringify(start) === signature) return;
    if (reducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    const keys = [...new Set([...Object.keys(start), ...Object.keys(target)])];
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - k) ** 4;
      const next: Record<string, number> = {};
      for (const c of keys) next[c] = Math.round((start[c] ?? 0) + ((target[c] ?? 0) - (start[c] ?? 0)) * e);
      from.current = k < 1 ? next : target;
      setShown(k < 1 ? next : target);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ms]);
  return shown;
}

/**
 * Keeps items that just left `items` around for `ms`, flagged as leaving, so
 * the list can play them out. `shouldLinger` decides which removals deserve it.
 */
export function useLingering<T>(items: readonly T[], keyOf: (item: T) => string, shouldLinger: (item: T) => boolean, ms = 950): { item: T; leaving: boolean }[] {
  const previous = useRef<readonly T[]>(items);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [gone, setGone] = useState<{ item: T; index: number; key: string }[]>([]);

  useEffect(() => {
    const now = new Set(items.map(keyOf));
    const removed = previous.current
      .map((item, index) => ({ item, index, key: keyOf(item) }))
      .filter((x) => !now.has(x.key) && shouldLinger(x.item));
    previous.current = items;
    if (removed.length === 0 || reducedMotion()) return;
    const keys = new Set(removed.map((r) => r.key));
    setGone((g) => [...g.filter((x) => !keys.has(x.key)), ...removed]);
    // Timers outlive later list changes on purpose; they're only cleared on unmount.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setGone((g) => g.filter((x) => !keys.has(x.key)));
    }, ms);
    timers.current.add(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const out: { item: T; leaving: boolean }[] = items.map((item) => ({ item, leaving: false }));
  for (const g of [...gone].sort((a, b) => a.index - b.index)) {
    if (out.some((o) => keyOf(o.item) === g.key)) continue;
    out.splice(Math.min(g.index, out.length), 0, { item: g.item, leaving: true });
  }
  return out;
}

/** False during the first render, true afterwards: lets remounting children animate only on real changes. */
export function useSettled(): boolean {
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);
  return settled.current;
}
