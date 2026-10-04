/**
 * Hosts surface validation failures as JSON `{ kind, errors }` embedded in the
 * error. SiYuan's JSON-RPC bridge puts it in `error.data` behind a prefix
 * (`message` is just "Internal error"); other hosts may use `message`.
 */
export function parseRpcErrors(e: unknown): string[] {
  const message = e instanceof Error ? e.message : String(e);
  const data = typeof e === "object" && e !== null ? (e as { data?: unknown }).data : undefined;
  for (const text of [typeof data === "string" ? data : "", message]) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as { errors?: unknown };
      if (Array.isArray(parsed.errors) && parsed.errors.every((x) => typeof x === "string")) return parsed.errors;
    } catch {
      // not JSON
    }
  }
  return [typeof data === "string" && data ? data : message];
}
