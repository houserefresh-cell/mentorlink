import test from "node:test";
import assert from "node:assert/strict";
import {
  getRoleSelectionDestination,
  resolveDashboardPath,
} from "./auth-routing-logic.ts";

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

test("authenticated unresolved mentor choice goes directly to existing onboarding", () => {
  assert.equal(
    getRoleSelectionDestination("mentor"),
    "/dashboard/mentor/onboarding",
  );
  assert.notEqual(getRoleSelectionDestination("mentor"), "/register");
  assert.notEqual(getRoleSelectionDestination("mentor"), "/register/mentor");
});

test("authenticated parent choice goes directly to the parent dashboard", () => {
  assert.equal(
    getRoleSelectionDestination("parent"),
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

test("saved mentor role skips setup on later login", () => {
  assert.equal(
    resolveDashboardPath({
      savedAccountRole: "mentor",
      hasStarterMentorProfile: false,
    }),
    "/dashboard/mentor/onboarding",
  );
});

test("saved parent role skips setup on later login", () => {
  assert.equal(
    resolveDashboardPath({ savedAccountRole: "parent" }),
    "/dashboard/parent",
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
  assert.notEqual(getRoleSelectionDestination("mentor"), "/setup");
  assert.notEqual(getRoleSelectionDestination("parent"), "/setup");
});
