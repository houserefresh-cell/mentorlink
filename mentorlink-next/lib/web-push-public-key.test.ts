import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicVapidKey } from "./web-push-public-key.ts";

function encode(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const validBytes = Uint8Array.from({ length: 65 }, (_, index) =>
  index === 0 ? 4 : index,
);
const validKey = encode(validBytes);

test("valid public VAPID key becomes a 65-byte P-256 application server key", () => {
  const result = parsePublicVapidKey(validKey);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.key, validKey);
  assert.deepEqual(new Uint8Array(result.applicationServerKey), validBytes);
});

test("quoted or whitespace-padded environment values are rejected safely", () => {
  assert.deepEqual(parsePublicVapidKey(` ${validKey}`), { ok: false });
  assert.deepEqual(parsePublicVapidKey(`${validKey}\n`), { ok: false });
  assert.deepEqual(parsePublicVapidKey(`"${validKey}"`), { ok: false });
  assert.deepEqual(parsePublicVapidKey(`'${validKey}'`), { ok: false });
});

test("malformed base64url and unsupported P-256 key shapes are rejected", () => {
  assert.deepEqual(parsePublicVapidKey("not+a+base64url/key"), { ok: false });
  assert.deepEqual(parsePublicVapidKey(encode(validBytes.slice(0, 64))), {
    ok: false,
  });
  const wrongPrefix = validBytes.slice();
  wrongPrefix[0] = 3;
  assert.deepEqual(parsePublicVapidKey(encode(wrongPrefix)), { ok: false });
});
