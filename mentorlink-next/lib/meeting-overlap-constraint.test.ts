import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canTransition, meetingEndAt } from "./meeting-scheduling-core.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read(
  "supabase/migrations/202607270010_create_parent_mentor_meeting_requests.sql",
);
const createRoute = read("app/api/meeting-requests/route.ts");
const actionRoute = read("app/api/meeting-requests/[requestId]/route.ts");
const dataLoader = read("lib/meeting-data.ts");

test("accepted meeting stores a canonical requested start and matching end", () => {
  const start = new Date("2026-08-10T12:00:00.000Z");
  assert.equal(
    meetingEndAt(start, 45)?.toISOString(),
    "2026-08-10T12:45:00.000Z",
  );
  assert.match(createRoute, /requested_end_at: requestedEnd\.toISOString\(\)/);
  assert.match(actionRoute, /requested_end_at: requestedEnd\.toISOString\(\)/);
  assert.match(
    migration,
    /requested_end_at\s*=\s*requested_start_at\s*\+\s*requested_duration_minutes\s*\*\s*interval '1 minute'/,
  );
});

test("unsupported durations cannot produce a canonical end", () => {
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 20), null);
  assert.match(migration, /requested_duration_minutes in \(30, 45, 60, 90\)/);
});

test("overlap exclusion uses only stored columns and a half-open interval", () => {
  assert.match(
    migration,
    /mentor_user_id with =,\s*tstzrange\(requested_start_at, requested_end_at, '\[\)'\) with &&/s,
  );
  assert.doesNotMatch(
    migration.match(/add constraint meeting_requests_no_accepted_overlap[\s\S]*?where \(status = 'accepted'\)/)?.[0] ?? "",
    /make_interval|requested_start_at\s*\+/,
  );
  assert.match(migration, /where \(status = 'accepted'\)/);
});

test("constraint scope allows adjacent, different-mentor, and non-accepted rows", () => {
  assert.match(migration, /mentor_user_id with =/);
  assert.match(migration, /'\[\)'/);
  assert.match(migration, /where \(status = 'accepted'\)/);
  for (const status of [
    "pending",
    "declined",
    "cancelled",
    "alternative_proposed",
  ]) {
    assert.doesNotMatch(
      migration.match(/where \(status = 'accepted'\)/)?.[0] ?? "",
      new RegExp(status),
    );
  }
});

test("accepted-slot loading uses the stored canonical end", () => {
  assert.match(
    dataLoader,
    /select\("requested_start_at, requested_end_at"\)/,
  );
  assert.match(dataLoader, /ends_at: meeting\.requested_end_at/);
  assert.doesNotMatch(dataLoader, /make_interval|requested_duration_minutes \* 60_000/);
});

test("current lifecycle cannot accept an alternative proposal", () => {
  assert.equal(
    canTransition("mentor", "alternative_proposed", "accept"),
    false,
  );
});

test("database overlap violations return a sanitized conflict", () => {
  assert.match(actionRoute, /result\.error\?\.code === "23P01"/);
  assert.match(actionRoute, /status: 409/);
  assert.doesNotMatch(actionRoute, /result\.error\.message/);
});
