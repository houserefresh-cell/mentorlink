import test from "node:test";
import assert from "node:assert/strict";
import { loadAuthorizedAdminReview } from "./admin-review-loader.ts";

test("authorized admin loader creates and injects the service-role data client", async () => {
  const events: string[] = [];
  const userScopedClient = { scope: "user" };
  const serviceRoleClient = { scope: "service-role" };

  const result = await loadAuthorizedAdminReview(
    "Bearer token",
    async () => {
      events.push("authorize");
      return { id: "admin-user-id", email: "admin@example.com" };
    },
    () => {
      events.push("create-service-role-client");
      return serviceRoleClient;
    },
    async (administrator, injectedClient) => {
      events.push("load-data");
      assert.equal(administrator.id, "admin-user-id");
      assert.equal(injectedClient, serviceRoleClient);
      assert.notEqual(injectedClient, userScopedClient);
      return "loaded";
    },
  );

  assert.equal(result, "loaded");
  assert.deepEqual(events, [
    "authorize",
    "create-service-role-client",
    "load-data",
  ]);
});

test("service-role client is never created when authorization fails", async () => {
  let created = false;
  await assert.rejects(
    loadAuthorizedAdminReview(
      "Bearer token",
      async () => {
        throw new Error("forbidden");
      },
      () => {
        created = true;
        return { scope: "service-role" };
      },
      async () => "unreachable",
    ),
    /forbidden/,
  );
  assert.equal(created, false);
});
