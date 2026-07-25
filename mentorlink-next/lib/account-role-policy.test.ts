import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountRoleRpcArguments } from "./account-role-policy.ts";

test("authenticated user can build arguments for their own valid account type", () => {
  assert.deepEqual(
    buildAccountRoleRpcArguments("current-user", {
      role: "mentor",
      ownerType: "parent_guardian",
    }),
    {
      requested_role: "mentor",
      requested_owner_type: "parent_guardian",
    },
  );
});

test("unauthenticated role assignment fails", () => {
  assert.throws(
    () => buildAccountRoleRpcArguments(null, { role: "mentor" }),
    /AUTH_REQUIRED/,
  );
});

test("invalid account type fails", () => {
  assert.throws(
    () => buildAccountRoleRpcArguments("current-user", { role: "admin" }),
    /INVALID_ACCOUNT_ROLE/,
  );
});

test("user cannot select or modify another user's account type", () => {
  assert.throws(
    () =>
      buildAccountRoleRpcArguments("current-user", {
        role: "parent",
        userId: "another-user",
      }),
    /TARGET_USER_NOT_ALLOWED/,
  );
});
