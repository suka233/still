/**
 * Random identifiers. `crypto.randomUUID` is unavailable in goja, so this
 * builds an RFC 4122 v4 UUID from an injectable random source.
 */
export function randomUuid(random: () => number = Math.random): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    let byte = Math.floor(random() * 256) & 0xff;
    if (i === 6) byte = (byte & 0x0f) | 0x40;
    if (i === 8) byte = (byte & 0x3f) | 0x80;
    hex.push(byte.toString(16).padStart(2, "0"));
  }
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
