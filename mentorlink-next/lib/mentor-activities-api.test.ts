import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const collection = read("app/api/mentor-activities/route.ts");
const item = read("app/api/mentor-activities/[activityId]/route.ts");
const duplicate = read("app/api/mentor-activities/[activityId]/duplicate/route.ts");
const data = read("lib/mentor-activity-data.ts");
const migration = read("supabase/migrations/202607310022_create_mentor_activities.sql");

test("mentor activity routes authenticate mentors and scope owned activities", () => {
  for (const source of [collection, item, duplicate]) assert.match(source, /authenticateMentorActivityUser/);
  assert.match(data, /authenticateMeetingUser/);
  assert.match(data, /user\.role !== "mentor"/);
  assert.match(data, /\.eq\("mentor_user_id", mentorUserId\)/);
  assert.match(item, /\.eq\("mentor_user_id", loaded\.user\.id\)/);
});

test("collection supports counts and validated draft or published creation", () => {
  assert.match(collection, /export async function GET/);
  assert.match(collection, /export async function POST/);
  assert.match(collection, /registrationCounts/);
  assert.match(collection, /validateActivityInput\(payload, publish \? "published" : "draft"\)/);
  assert.match(collection, /activeSubjectExists/);
  assert.doesNotMatch(data, /mentor_subjects/);
});

test("item route edits, publishes, cancels and restricts deletion", () => {
  assert.match(item, /export async function GET/);
  assert.match(item, /export async function PATCH/);
  assert.match(item, /action === "publish"/);
  assert.match(item, /action === "cancel"/);
  assert.match(item, /canTransitionActivity/);
  assert.match(item, /loaded\.activity\.status !== "draft"/);
  assert.match(item, /Published activities cannot be deleted/);
  assert.match(item, /ACTIVITY_HAS_REGISTRATIONS/);
  assert.match(item, /\.eq\("status", "draft"\)/);
});

test("POST and PATCH save activity and sessions only through the atomic RPC", () => {
  assert.match(collection, /\.rpc\("save_mentor_activity"/);
  assert.match(item, /\.rpc\("save_mentor_activity"/);
  assert.doesNotMatch(collection + item, /replaceActivitySessions|findPublicationConflict|previousActivity/);
  assert.doesNotMatch(collection + item, /from\("mentor_activity_sessions"\)\.(?:insert|delete|update)/);
});

test("publication conflicts and mentor lock live inside the database transaction", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_mentor_user_id::text, 0\)\)/);
  assert.match(migration, /existing_activity\.status = 'published'/);
  assert.match(migration, /existing_activity\.id <> v_activity_id/);
  assert.match(migration, /meeting\.status = 'accepted'/);
  assert.match(migration, /coalesce\(meeting\.confirmed_start_at, meeting\.requested_start_at\)/);
  assert.match(migration, /coalesce\(meeting\.confirmed_end_at, meeting\.requested_end_at\)/);
  assert.doesNotMatch(migration + collection + item, /mentor_availability|blackout_period/);
});

test("duplicate creates a fresh draft without sessions, dates or registrations", () => {
  assert.match(duplicate, /`עותק של \$\{source\.title\}`/);
  assert.match(duplicate, /status: "draft"/);
  assert.match(duplicate, /registration_deadline: null/);
  assert.match(duplicate, /published_at: null/);
  assert.match(duplicate, /sessions: \[\]/);
  assert.doesNotMatch(duplicate, /mentor_activity_(?:sessions|registrations)[\s\S]*insert/);
});
