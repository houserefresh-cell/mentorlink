import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202608030031_complete_activity_registration_privacy.sql", "utf8");
const mentorApi = fs.readFileSync("app/api/mentor-activities/[activityId]/registrations/route.ts", "utf8");

test("activity contact visibility has three explicit policies and a safe default", () => {
  assert.match(migration, /default 'registered_parents'/);
  for (const policy of ["public", "registered_parents", "mentor_approved"]) assert.match(migration, new RegExp(policy));
});

test("registration is serialized, child-owned, atomic and replayable by idempotency key", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /parent_user_id = p_parent_user_id/);
  assert.match(migration, /status in \('registered', 'waitlisted'\)/);
  assert.match(migration, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(migration, /continue;/);
});

test("mentor registration details require activity ownership and hide waitlisted phone", () => {
  assert.match(mentorApi, /mentor_user_id !== user\.id/);
  assert.match(mentorApi, /row\.status === "registered" \? parent\?\.phone/);
  assert.match(mentorApi, /familyInitial/);
  assert.doesNotMatch(mentorApi, /accommodation_notes|birth_date|school_name/);
});

test("mentor approvals require ownership and a registered parent", () => {
  assert.match(migration, /ACTIVITY_NOT_OWNED/);
  assert.match(migration, /PARENT_NOT_REGISTERED/);
  assert.match(migration, /status = 'registered'/);
});
