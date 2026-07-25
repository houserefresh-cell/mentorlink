import test from "node:test";
import assert from "node:assert/strict";
import { resolveDashboardPath } from "./auth-routing-logic.ts";

test("routes parent accounts to the parent dashboard", () => {
  assert.equal(
    resolveDashboardPath({ persistedRoleHint: "parent" }),
    "/dashboard/parent",
  );
});

test("routes explicit parent registration to the parent dashboard", () => {
  assert.equal(
    resolveDashboardPath({ registrationRole: "parent" }),
    "/dashboard/parent",
  );
});

test("routes mentor accounts with starter profile to the mentor dashboard", () => {
  assert.equal(
    resolveDashboardPath({
      hasMentorOwnership: true,
      hasStarterMentorProfile: true,
    }),
    "/dashboard/mentor",
  );
});

test("routes mentor accounts without starter profile to onboarding", () => {
  assert.equal(
    resolveDashboardPath({
      hasMentorOwnership: true,
      hasStarterMentorProfile: false,
    }),
    "/dashboard/mentor/onboarding",
  );
});

test("routes new mentor registration to onboarding before the ownership snapshot refreshes", () => {
  assert.equal(
    resolveDashboardPath({
      registrationRole: "mentor",
      hasMentorOwnership: false,
      hasStarterMentorProfile: false,
    }),
    "/dashboard/mentor/onboarding",
  );
});

test("does not treat a mentor metadata hint without database ownership as authorization", () => {
  assert.equal(
    resolveDashboardPath({
      persistedRoleHint: "mentor",
      hasMentorOwnership: false,
    }),
    "/setup",
  );
});

test("database mentor ownership takes precedence over a parent metadata hint", () => {
  assert.equal(
    resolveDashboardPath({
      persistedRoleHint: "parent",
      hasMentorOwnership: true,
      hasStarterMentorProfile: false,
    }),
    "/dashboard/mentor/onboarding",
  );
});

test("falls back to the setup page for unresolved users", () => {
  assert.equal(resolveDashboardPath({}), "/setup");
});
