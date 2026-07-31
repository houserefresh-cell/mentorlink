import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const item = read("app/api/mentor-activities/[activityId]/route.ts");
const updates = read("app/api/mentor-activities/[activityId]/updates/route.ts");
const manager = read("app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx");
const form = read("app/dashboard/mentor/activities/_components/MentorActivityForm.tsx");
const migration = read("supabase/migrations/202607310024_add_activity_operational_updates.sql");

test("active registrations lock edits atomically and are exposed to the editor", () => {
  assert.match(migration, /ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS/);
  assert.match(migration, /status in \('registered', 'waitlisted'\)/);
  assert.match(item, /ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS/);
  assert.match(item, /edit_locked:/);
  assert.match(form, /activity\.edit_locked/);
  assert.match(manager, /published" && registered \+ waitlisted === 0/);
});

test("operational updates are owner scoped and reveal only active recipient child names", () => {
  assert.match(updates, /authenticateMentorActivityUser/);
  assert.match(updates, /loadOwnedActivity/);
  assert.match(updates, /\.in\("status", \["registered", "waitlisted"\]\)/);
  assert.match(updates, /childFirstNames/);
  assert.doesNotMatch(updates, /child_needs|child_grade_or_age/);
  assert.match(migration, /RECIPIENT_NOT_REGISTERED/);
  assert.match(migration, /revoke all on public\.mentor_activity_updates from public, anon, authenticated/);
  assert.match(migration, /to service_role/);
});

test("all-recipient, parent, delay and postponement updates are validated", () => {
  assert.match(manager, /value="all_active"/);
  assert.match(manager, /value="parent"/);
  assert.match(manager, /value="delay"/);
  assert.match(manager, /value="postponement"/);
  assert.match(updates, /Number\.isFinite\(proposedStartMs\)/);
  assert.match(updates, /INVALID_DELAY/);
  assert.match(migration, /mentor_activity_updates_recipient_check/);
  assert.match(migration, /mentor_activity_updates_delay_check/);
  assert.match(migration, /mentor_activity_updates_postponement_check/);
});

test("cancellation requires a reason and notifies active registrations transactionally", () => {
  assert.match(item, /CANCELLATION_REASON_REQUIRED/);
  assert.match(item, /cancel_mentor_activity_with_update/);
  assert.match(manager, /reason\.trim\(\)\.length < 3/);
  assert.match(migration, /p_update_type = 'cancellation' and status = 'cancelled'/);
  assert.match(migration, /'all_active', null, 'cancellation', p_reason/);
  assert.match(migration, /'mentor_activity_update', 'עדכון לפעילות'/);
});