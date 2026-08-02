import test from "node:test";
import assert from "node:assert/strict";
import { resolveMentorRegistrationView } from "./mentor-register-view.ts";

test("guest on mentor registration sees account signup", () => {
  assert.deepEqual(
    resolveMentorRegistrationView({
      isAuthenticated: false,
      role: null,
      hasCompletedMentorProfile: false,
      hasSubmittedForReview: false,
    }),
    { view: "signup" },
  );
});

test("authenticated mentor without a profile sees full onboarding", () => {
  assert.deepEqual(
    resolveMentorRegistrationView({
      isAuthenticated: true,
      role: "mentor",
      hasCompletedMentorProfile: false,
      hasSubmittedForReview: false,
    }),
    { view: "onboarding" },
  );
});

test("authenticated mentor never sees signup fields again", () => {
  assert.notEqual(
    resolveMentorRegistrationView({
      isAuthenticated: true,
      role: "mentor",
      hasCompletedMentorProfile: false,
      hasSubmittedForReview: false,
    }).view,
    "signup",
  );
});

test("completed mentor is redirected to the mentor dashboard", () => {
  assert.deepEqual(
    resolveMentorRegistrationView({
      isAuthenticated: true,
      role: "mentor",
      hasCompletedMentorProfile: true,
      hasSubmittedForReview: true,
    }),
    { view: "redirect", destination: "/dashboard/mentor" },
  );
});

test("parent-only user cannot access mentor onboarding", () => {
  assert.deepEqual(
    resolveMentorRegistrationView({
      isAuthenticated: true,
      role: "parent",
      hasCompletedMentorProfile: false,
      hasSubmittedForReview: false,
    }),
    { view: "redirect", destination: "/dashboard/parent" },
  );
});

test("completed mentor keeps the review-submit button until the profile is actually submitted", () => {
  assert.deepEqual(
    resolveMentorRegistrationView({
      isAuthenticated: true,
      role: "mentor",
      hasCompletedMentorProfile: true,
      hasSubmittedForReview: false,
    }),
    { view: "onboarding" },
  );
});
