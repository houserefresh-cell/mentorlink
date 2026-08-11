import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202608040032_add_parent_profiles_and_activity_feedback.sql", "utf8");
const parentApi = fs.readFileSync("app/api/parent/activity-feedback/route.ts", "utf8");
const mentorApi = fs.readFileSync("app/api/mentor-feedback/route.ts", "utf8");
const adminApi = fs.readFileSync("app/api/admin/activity-feedback/route.ts", "utf8");
const registrations = fs.readFileSync("app/dashboard/parent/activities/ParentRegistrations.tsx", "utf8");
const parentShell = fs.readFileSync("app/dashboard/parent/_components/ParentDashboardShell.tsx", "utf8");
const activityUpdatesApi = fs.readFileSync("app/api/parent/activity-updates/route.ts", "utf8");

test("feedback is tied to one completed registration and uses explicit five-point scores", () => {
  assert.match(migration, /registration_id uuid not null unique/);
  assert.match(migration, /professionalism between 1 and 5/);
  assert.match(parentApi, /ניתן למלא משוב רק לאחר סיום הפעילות/);
  assert.match(parentApi, /eq\("status","registered"\)/);
  assert.match(parentApi, /כבר נשלח משוב עבור הרשמה זו/);
});

test("a parent with multiple children can archive an activity update", () => {
  assert.match(activityUpdatesApi, /eq\("parent_user_id",user\.id\)\.limit\(1\)\.maybeSingle\(\)/);
});

test("mentor feedback excludes private safety and moderation fields", () => {
  assert.match(mentorApi, /professionalism/);
  assert.match(mentorApi, /could_improve/);
  assert.doesNotMatch(mentorApi, /private_safety_details|admin_notes|publication_status/);
});

test("administrator receives complete safety and publication workflow", () => {
  assert.match(adminApi, /mentor_activity_feedback"\)\.select\("\*"\)/);
  assert.match(adminApi, /publication_status/);
  assert.match(adminApi, /admin_handling_status/);
  assert.match(adminApi, /publicationStatus==="approved"&&!current\.data\.allow_public_quote/);
});

test("completed registrations cannot be cancelled and lead to feedback", () => {
  assert.match(registrations, /completed \? \{ label: "הפעילות הסתיימה"/);
  assert.match(registrations, /!cancelled && !completed/);
  assert.match(registrations, /completed && row\.status === "registered"/);
  assert.match(registrations, /dashboard\/parent\/feedback\?registrationId/);
  assert.match(parentShell, /pendingCount/);
  assert.match(parentShell, /bg-violet-200/);
});
