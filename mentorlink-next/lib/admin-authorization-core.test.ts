import test from "node:test";
import assert from "node:assert/strict";
import {
  excludeAdministrator,
  getBearerToken,
  isConfiguredAdministrator,
  isUuid,
} from "./admin-authorization-core.ts";

test("administrator email comparison is normalized and fails closed", () => {
  assert.equal(
    isConfiguredAdministrator(" Admin@Example.com ", "admin@example.com"),
    true,
  );
  assert.equal(
    isConfiguredAdministrator("other@example.com", "admin@example.com"),
    false,
  );
  assert.equal(isConfiguredAdministrator("admin@example.com", undefined), false);
  assert.equal(isConfiguredAdministrator(undefined, undefined), false);
});

test("only a well-formed bearer token is accepted", () => {
  assert.equal(getBearerToken("Bearer access-token"), "access-token");
  assert.equal(getBearerToken("bearer access-token"), "access-token");
  assert.equal(getBearerToken("Basic access-token"), null);
  assert.equal(getBearerToken("Bearer two tokens"), null);
  assert.equal(getBearerToken(null), null);
});

test("the authenticated administrator is excluded from review results", () => {
  const rows = [
    { user_id: "mentor-1", status: "pending_review" },
    { user_id: "administrator", status: "pending_review" },
  ];
  assert.deepEqual(excludeAdministrator(rows, "administrator"), [rows[0]]);
});

test("dynamic mentor identifiers must be UUIDs", () => {
  assert.equal(isUuid("a2a2a2a2-2222-4222-8222-a2a2a2a2a2a2"), true);
  assert.equal(isUuid("../administrator"), false);
  assert.equal(isUuid("not-a-uuid"), false);
});
