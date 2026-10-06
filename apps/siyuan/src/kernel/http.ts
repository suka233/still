/**
 * Outbound HTTP for the kernel plugin. `siyuan.client.fetch` only reaches the
 * local kernel, so external requests go through SiYuan's forward proxy.
 */
import { httpResponse, type HttpRequest, type HttpResponse } from "@still/engine";

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
  return httpResponse(envelope.data.status, envelope.data.body);
}
