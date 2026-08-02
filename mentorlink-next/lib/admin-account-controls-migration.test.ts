import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202608020029_add_admin_mentor_account_controls.sql"), "utf8");

test("account controls and immutable administration history are service-role only", () => {
  assert.match(migration, /create table public\.mentor_account_controls/);
  assert.match(migration, /create table public\.mentor_account_admin_events/);
  assert.match(migration, /revoke all[\s\S]+from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.mentor_account_controls to service_role/);
});

test("mentor-owned activities cascade only after explicit auth account deletion", () => {
  assert.match(migration, /mentor_activities_mentor_user_id_fkey[\s\S]+on delete cascade/);
  assert.match(migration, /mentor_activity_updates_sender_user_id_fkey[\s\S]+on delete cascade/);
});
