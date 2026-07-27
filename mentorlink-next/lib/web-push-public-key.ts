const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type PublicVapidKeyResult =
  | { ok: true; key: string; applicationServerKey: ArrayBuffer }
  | { ok: false };

export function parsePublicVapidKey(value: unknown): PublicVapidKeyResult {
  if (typeof value !== "string") return { ok: false };
  const key = value.trim();
  if (
    !key ||
    key !== value ||
    key.startsWith('"') ||
    key.startsWith("'") ||
    !BASE64URL_PATTERN.test(key)
  ) {
    return { ok: false };
  }

  try {
    const padded = `${key}${"=".repeat((4 - key.length % 4) % 4)}`
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const bytes = Uint8Array.from(
      atob(padded),
      (character) => character.charCodeAt(0),
    );
    if (bytes.length !== 65 || bytes[0] !== 4) return { ok: false };
    const applicationServerKey = new ArrayBuffer(bytes.length);
    new Uint8Array(applicationServerKey).set(bytes);
    return { ok: true, key, applicationServerKey };
  } catch {
    return { ok: false };
  }
}
