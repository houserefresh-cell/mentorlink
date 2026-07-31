import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202607310026_create_parent_activity_registration.sql", "utf8");
const activityApi = fs.readFileSync("app/api/parent/activities/route.ts", "utf8");
const registrationApi = fs.readFileSync("app/api/parent/activity-registrations/route.ts", "utf8");
const discovery = fs.readFileSync("app/dashboard/parent/_components/ParentActivityDiscovery.tsx", "utf8");
const imageApi = fs.readFileSync("app/api/mentor-activities/[activityId]/image/route.ts", "utf8");

test("parent children are private service-owned records", () => {
  assert.match(migration, /create table public\.parent_children/);
  assert.match(migration, /parent_user_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /revoke all on public\.parent_children from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.parent_children to service_role/);
});

test("multi-child registration is atomic, capacity locked and ownership checked", () => {
  assert.match(migration, /create or replace function public\.register_children_for_activity/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /id = v_child_id and parent_user_id = p_parent_user_id/);
  assert.match(migration, /v_registered_count < v_activity\.max_participants/);
  assert.match(migration, /then 'registered' else 'waitlisted'/);
  assert.match(migration, /DUPLICATE_CHILD_SELECTION/);
});

test("parent APIs enforce role and avoid exposing exact home addresses", () => {
  assert.match(activityApi, /user\.role !== "parent"/);
  assert.doesNotMatch(activityApi, /address: activity\.address/);
  assert.match(registrationApi, /p_parent_user_id: user\.id/);
  assert.match(registrationApi, /cancel_parent_activity_registration/);
});

test("parent experience leads with activities and selects children first", () => {
  assert.match(discovery, /פעילויות חדשות וקרובות/);
  assert.match(discovery, /עבור מי מחפשים/);
  assert.match(discovery, /את מי תרצו לרשום/);
  assert.match(discovery, /childIds: selectedIds/);
  assert.match(discovery, /רשימת ההמתנה/);
});

test("postponement responses are private, registration scoped and notify the mentor", () => {
  assert.match(migration, /create table public\.mentor_activity_postponement_responses/);
  assert.match(migration, /r\.parent_user_id = p_parent_user_id/);
  assert.match(migration, /respond_to_activity_postponement/);
  assert.match(migration, /תגובה להצעת דחיית פעילות/);
});

test("activity images are validated, owner scoped and locked after registration", () => {
  assert.match(migration, /activity-images/);
  assert.match(migration, /file_size_limit/);
  assert.match(imageApi, /eq\("mentor_user_id",authentication\.user\.id\)/);
  assert.match(imageApi, /registered","waitlisted/);
  assert.match(imageApi, /file\.size>5242880/);
});

test("child preferences include kindergarten, school and shared subject interests", () => {
  const preferences = fs.readFileSync("supabase/migrations/202608010027_add_child_activity_preferences.sql", "utf8");
  assert.match(preferences, /'kindergarten'/);
  assert.match(preferences, /school_name text/);
  assert.match(preferences, /parent_child_subject_interests/);
  assert.match(preferences, /subject_id bigint not null references public\.subjects/);
  assert.match(preferences, /create or replace function public\.save_parent_child_preferences/);
  assert.match(preferences, /delete from public\.parent_child_subject_interests where child_id = v_child_id/);
  assert.match(preferences, /grant execute on function public\.save_parent_child_preferences[^\n]+to service_role/);
});

test("published upcoming activities remain visible without child preferences", () => {
  assert.match(activityApi, /select\("id, name, category"\)/);
  assert.doesNotMatch(activityApi, /\.gt\("registration_deadline"/);
  assert.match(activityApi, /registrationOpen:/);
  assert.match(discovery, /if \(!child\) return activities/);
  assert.match(discovery, /ההרשמה נסגרה/);
});

test("mentor cards provide direct access to their activities and registration cards", () => {
  const directory = fs.readFileSync("app/_components/PublicMentorDirectory.tsx", "utf8");
  assert.match(directory, /פעילויות של החונך — לצפייה ולהרשמה/);
  assert.match(directory, /href={`#activity-\${activity\.id}`}/);
  assert.match(directory, /מעבר לפעילות ולהרשמה/);
  assert.match(discovery, /id={`activity-\${activity\.id}`}/);
});
