import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { loadAuthorizedAdminReview } from "./admin-review-loader.ts";

for (const [name, message] of [
  ["unauthenticated user", "Authentication required"],
  ["non-admin user", "Administrator access required"],
] as const) {
  test(`${name} cannot create a publication service-role client`, async () => {
    let created = false;
    await assert.rejects(
      loadAuthorizedAdminReview(
        "Bearer token",
        async () => { throw new Error(message); },
        () => { created = true; return {}; },
        async () => "unreachable",
      ),
      new RegExp(message),
    );
    assert.equal(created, false);
  });
}

test("publication and public mentor data operations remain server-only", async () => {
  for (const file of ["admin-publication-action.ts", "public-mentor-data.ts"]) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /^import "server-only";/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  }
  const route = await readFile(
    new URL("../app/api/admin/mentors/[userId]/publication/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(route.indexOf("authorizeAdministrator") < route.indexOf("createSupabaseAdmin()"));
  assert.match(route, /revalidatePath\("\/"\)/);
});
