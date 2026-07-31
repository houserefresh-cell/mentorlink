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
