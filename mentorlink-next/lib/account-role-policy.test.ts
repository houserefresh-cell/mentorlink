import test from "node:test";
import assert from "node:assert/strict";
import {
  addAccountRole,
  buildAccountRoleRpcArguments,
} from "./account-role-policy.ts";

test("mentor-only role assignment is valid", () => {
  assert.deepEqual(
    buildAccountRoleRpcArguments("current-user", {
      role: "mentor",
      managesMentorProfile: true,
    }),
    {
      requested_role: "mentor",
      requested_manages_mentor_profile: true,
    },
  );
  assert.deepEqual(addAccountRole([], "mentor"), ["mentor"]);
});

test("parent-guardian-only role assignment is valid", () => {
  assert.deepEqual(
    buildAccountRoleRpcArguments("current-user", {
      role: "parent_guardian",
    }),
    {
      requested_role: "parent_guardian",
      requested_manages_mentor_profile: false,
    },
  );
  assert.deepEqual(addAccountRole([], "parent_guardian"), [
    "parent_guardian",
  ]);
});

test("dual-role account preserves both legitimate roles", () => {
  assert.deepEqual(
    addAccountRole(["mentor"], "parent_guardian"),
    ["mentor", "parent_guardian"],
  );
});

test("adding a second legitimate role does not remove the first", () => {
  assert.deepEqual(
    addAccountRole(["parent_guardian"], "mentor"),
    ["parent_guardian", "mentor"],
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
        role: "parent_guardian",
        userId: "another-user",
      }),
    /TARGET_USER_NOT_ALLOWED/,
  );
});
