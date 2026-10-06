/**
 * Outbound HTTP for the kernel plugin. `siyuan.client.fetch` only reaches the
 * local kernel, so external requests go through SiYuan's forward proxy.
 */
export interface HttpRequest {
  url: string;
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  /** Sent as JSON unless `text` is set. */
  json?: unknown;
  text?: string;
  contentType?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
  json<T = unknown>(): T | null;
}

export async function httpRequest(req: HttpRequest): Promise<HttpResponse> {
  const options: Record<string, unknown> = {
    url: req.url,
    method: req.method ?? "GET",
    timeout: req.timeoutMs ?? 10_000,
    headers: Object.entries(req.headers ?? {}).map(([k, v]) => ({ [k]: v })),
  };
  if (req.text !== undefined) {
    options.payload = req.text;
    options.payloadEncoding = "text";
    options.contentType = req.contentType ?? "text/plain; charset=utf-8";
  } else if (req.json !== undefined) {
    options.payload = req.json;
    options.contentType = req.contentType ?? "application/json";
  }
  const res = await siyuan.client.fetch("/api/network/forwardProxy", { method: "POST", body: JSON.stringify(options) });
  const envelope = (await res.json()) as { code: number; msg: string; data?: { status: number; body: string } };
  // URLs and proxy messages can contain credentials (bot tokens, webhook keys).
  if (envelope.code !== 0 || !envelope.data) throw new Error("forwardProxy request failed");
  const { status, body } = envelope.data;
  return {
    status,
    body,
    json<T>() {
      try {
        return JSON.parse(body) as T;
      } catch {
        return null;
      }
    },
  };
}
