import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canTransition, meetingEndAt } from "./meeting-scheduling-core.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const originalMigration = read("supabase/migrations/202607270010_create_parent_mentor_meeting_requests.sql");
const durationMigration = read("supabase/migrations/202607270013_create_field_level_mentor_review.sql");
const confirmedMigration = read("supabase/migrations/202607300017_add_confirmed_meeting_interval.sql");
const customDurationMigration = read("supabase/migrations/202607310021_allow_ten_minute_custom_durations.sql");
const crossScheduleMigration = read("supabase/migrations/202608210045_rich_attention_and_cross_schedule_guards.sql");
const createRoute = read("app/api/meeting-requests/route.ts");
const actionRoute = read("app/api/meeting-requests/[requestId]/route.ts");
const dataLoader = read("lib/meeting-data.ts");

test("original request interval remains immutable and confirmed interval is canonical", () => {
  const start = new Date("2026-08-10T12:00:00.000Z");
  assert.equal(meetingEndAt(start, 45)?.toISOString(), "2026-08-10T12:45:00.000Z");
  assert.match(createRoute, /requested_end_at: requestedEnd\.toISOString\(\)/);
  assert.doesNotMatch(actionRoute, /requested_start_at\s*:/);
  assert.doesNotMatch(actionRoute, /requested_end_at\s*:/);
  assert.match(actionRoute, /confirmed_start_at: start\.toISOString\(\)/);
  assert.match(actionRoute, /confirmed_end_at: end\.toISOString\(\)/);
  assert.match(actionRoute, /confirmed_duration_minutes: duration/);
  assert.match(originalMigration, /requested_end_at\s*=\s*requested_start_at\s*\+\s*requested_duration_minutes\s*\*\s*interval '1 minute'/);
  assert.match(confirmedMigration, /confirmed_end_at = confirmed_start_at \+ confirmed_duration_minutes \* interval '1 minute'/);
});

test("supported custom durations produce a canonical confirmed end", () => {
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 9), null);
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 12)?.toISOString(), "2026-08-10T12:12:00.000Z");
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 75)?.toISOString(), "2026-08-10T13:15:00.000Z");
  assert.match(durationMigration, /requested_duration_minutes between 15 and 180/);
  assert.match(confirmedMigration, /confirmed_duration_minutes between 15 and 180/);
  assert.match(customDurationMigration, /requested_duration_minutes between 10 and 180/);
  assert.match(customDurationMigration, /confirmed_duration_minutes between 10 and 180/);
});

test("accepted overlap protection uses the actual confirmed interval", () => {
  assert.match(confirmedMigration, /drop constraint if exists meeting_requests_no_accepted_overlap/);
  assert.match(confirmedMigration, /coalesce\(confirmed_start_at, requested_start_at\)/);
  assert.match(confirmedMigration, /coalesce\(confirmed_end_at, requested_end_at\)/);
  assert.match(confirmedMigration, /'\[\)'/);
  assert.match(confirmedMigration, /where \(status = 'accepted'\)/);
});

test("slot loading blocks confirmed alternatives and legacy accepted requests", () => {
  assert.match(dataLoader, /confirmed_start_at, confirmed_end_at/);
  assert.match(dataLoader, /meeting\.confirmed_start_at \?\? meeting\.requested_start_at/);
  assert.match(dataLoader, /meeting\.confirmed_end_at \?\? meeting\.requested_end_at/);
  assert.match(dataLoader, /mentor_activity_sessions/);
  assert.match(dataLoader, /activitySessions\.data/);
});

test("database guards prevent meeting and activity intervals from overlapping", () => {
  assert.match(crossScheduleMigration, /guard_meeting_against_activity_overlap/);
  assert.match(crossScheduleMigration, /guard_published_activity_session_against_meeting_overlap/);
  assert.match(crossScheduleMigration, /pg_advisory_xact_lock/);
  assert.match(crossScheduleMigration, /tstzrange\([\s\S]*?'\[\)'\)[\s\S]*?&&/);
  assert.match(crossScheduleMigration, /errcode = '23P01'/);
});

test("only the parent can respond to an alternative proposal", () => {
  assert.equal(canTransition("parent", "alternative_proposed", "accept_alternative"), true);
  assert.equal(canTransition("parent", "alternative_proposed", "decline_alternative"), true);
  assert.equal(canTransition("mentor", "alternative_proposed", "accept"), false);
  assert.equal(canTransition("parent", "accepted", "accept_alternative"), true);
});

test("conditional update and exclusion violation prevent simultaneous acceptance", () => {
  assert.match(actionRoute, /\.eq\("status", current\.status\)/);
  assert.match(actionRoute, /result\.error\?\.code === "23P01"/);
  assert.match(actionRoute, /status: 409/);
  assert.doesNotMatch(actionRoute, /result\.error\.message/);
});
