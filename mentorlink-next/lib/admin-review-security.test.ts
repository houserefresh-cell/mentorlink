import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadAuthorizedAdminReview } from "./admin-review-loader.ts";

for (const [name, message] of [
  ["unauthenticated user", "Authentication required"],
  ["non-admin user", "Administrator access required"],
] as const) {
  test(`${name} is denied before a service-role client is created`, async () => {
    let serviceClientCreated = false;
    await assert.rejects(
      loadAuthorizedAdminReview(
        "Bearer token",
        async () => {
          throw new Error(message);
        },
        () => {
          serviceClientCreated = true;
          return {};
        },
        async () => "unreachable",
      ),
      new RegExp(message),
    );
    assert.equal(serviceClientCreated, false);
  });
}

test("service-role review update implementation remains server-only", async () => {
  const source = await readFile(
    new URL("./admin-review-action.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /\.eq\("status", "pending_review"\)/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
