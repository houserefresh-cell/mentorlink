import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = [
  "supabase/migrations/202608030031_complete_activity_registration_privacy.sql",
  "supabase/migrations/202608040033_finalize_activity_registration_management.sql",
].map((path) => fs.readFileSync(path, "utf8")).join("\n");
const mentorApi = fs.readFileSync("app/api/mentor-activities/[activityId]/registrations/route.ts", "utf8");
const parentApi = fs.readFileSync("app/api/parent/activity-registrations/route.ts", "utf8");
const manager = fs.readFileSync("app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx", "utf8");
const registrationFeed = fs.readFileSync("app/api/mentor-activity-registrations/route.ts", "utf8");
const registrationPage = fs.readFileSync("app/dashboard/mentor/activity-registrations/page.tsx", "utf8");
const notificationMigration = fs.readFileSync("supabase/migrations/202608100034_activity_update_reads_and_registration_notifications.sql", "utf8");

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

test("mentor registration details require ownership and expose linked family contact details", () => {
  assert.match(mentorApi, /mentor_user_id !== user\.id/);
  assert.match(mentorApi, /parentPhone: parent\?\.phone/);
  assert.match(mentorApi, /parentProfile:/);
  assert.match(mentorApi, /school_name/);
  assert.match(mentorApi, /interests:/);
});

test("mentor approvals require ownership and a registered parent", () => {
  assert.match(migration, /ACTIVITY_NOT_OWNED/);
  assert.match(migration, /PARENT_NOT_REGISTERED/);
  assert.match(migration, /status = 'registered'/);
});

test("activity save persists the phone policy and protects a minor public number", () => {
  assert.match(migration, /save_mentor_activity_before_contact_visibility/);
  assert.match(migration, /set contact_phone_visibility = v_visibility/);
  assert.match(migration, /PUBLIC_PHONE_REQUIRES_PARENT_CONSENT/);
  assert.match(migration, /contact_confirmed = true/);
});

test("parent phone requires a registered row and mentor UI supports explicit approval", () => {
  assert.match(parentApi, /const isRegistered = registration\.status === "registered"/);
  assert.match(parentApi, /mentor_approved[\s\S]*approvedActivityIds/);
  assert.match(mentorApi, /contactApproved/);
  assert.match(mentorApi, /parentUserId: row\.parent_user_id/);
  assert.match(manager, /ניהול הרשמות/);
  assert.match(manager, /אישור הצגת הטלפון להורה/);
});

test("cancellation revokes stale approval and promotes the oldest waitlisted child", () => {
  assert.match(migration, /delete from public\.mentor_activity_contact_approvals/);
  assert.match(migration, /order by created_at[\s\S]*for update skip locked[\s\S]*limit 1/);
  assert.match(migration, /התפנה מקום בפעילות/);
});

test("mentor receives a dedicated activity registration feed with family and session details", () => {
  assert.match(notificationMigration, /הרשמה חדשה לפעילות/);
  assert.match(notificationMigration, /dashboard\/mentor\/activity-registrations/);
  assert.match(registrationFeed, /parent_profiles/);
  assert.match(registrationFeed, /mentor_activity_sessions/);
  assert.match(registrationPage, /הרשמות חדשות לפעילויות/);
  assert.match(registrationPage, /חיוג להורה/);
});

test("activity updates can be read and moved to parent history", () => {
  assert.match(notificationMigration, /mentor_activity_update_reads/);
  const parentUpdates = fs.readFileSync("app/dashboard/parent/activities/ParentActivityUpdates.tsx", "utf8");
  assert.match(parentUpdates, /העברה להיסטוריה/);
  assert.match(parentUpdates, /readAt/);
});
