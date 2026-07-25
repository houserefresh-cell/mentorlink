import test from "node:test";
import assert from "node:assert/strict";
import { resolveDashboardPath } from "./dashboard-route.ts";

test("mentor without a completed profile returns to mentor registration", () => {
  assert.equal(
    resolveDashboardPath({
      role: "mentor",
      hasCompletedMentorProfile: false,
    }),
    "/register/mentor",
  );
});

test("mentor with a completed profile reaches the mentor dashboard", () => {
  assert.equal(
    resolveDashboardPath({
      role: "mentor",
      hasCompletedMentorProfile: true,
    }),
    "/dashboard/mentor",
  );
});

test("parent reaches the parent dashboard", () => {
  assert.equal(
    resolveDashboardPath({
      role: "parent",
      hasCompletedMentorProfile: false,
    }),
    "/dashboard/parent",
  );
});

test("mentor-only user cannot enter the parent dashboard", () => {
  assert.notEqual(
    resolveDashboardPath({
      role: "mentor",
      hasCompletedMentorProfile: false,
    }),
    "/dashboard/parent",
  );
});

test("missing mentor profile does not imply parent", () => {
  assert.notEqual(
    resolveDashboardPath({
      role: "mentor",
      hasCompletedMentorProfile: false,
    }),
    "/dashboard/parent",
  );
});

test("unknown role does not default to parent", () => {
  assert.equal(
    resolveDashboardPath({
      role: "unknown",
      hasCompletedMentorProfile: false,
    }),
    "/register",
  );
});
