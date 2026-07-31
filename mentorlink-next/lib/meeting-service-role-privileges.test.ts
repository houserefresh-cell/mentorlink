import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read(
  "supabase/migrations/202607270011_restrict_meeting_service_role_privileges.sql",
);
const confirmedIntervalMigration = read(
  "supabase/migrations/202607300017_add_confirmed_meeting_interval.sql",
);
const availabilityRoute = read("app/api/mentor-availability/route.ts");
const meetingRoutes =
  read("app/api/meeting-requests/route.ts") +
  read("app/api/meeting-requests/[requestId]/route.ts");
const meetingData = read("lib/meeting-data.ts");
const notificationSources =
  read("app/api/notifications/route.ts") +
  read("lib/meeting-notifications.ts");

test("migration targets only the five meeting-system tables and service_role", () => {
  const tables = [
    ...migration.matchAll(/(?:table\s+|on\s+)(public\.[a-z_]+)/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(tables)].sort(),
    [
      "public.administrator_blackout_periods",
      "public.meeting_requests",
      "public.mentor_availability_windows",
      "public.mentor_blackout_periods",
      "public.notifications",
    ],
  );
  assert.doesNotMatch(migration, /\b(?:anon|authenticated|postgres)\b/);
  assert.doesNotMatch(
    migration,
    /alter default privileges|alter table.*(?:disable|enable) row level security|create policy|drop policy/is,
  );
});

test("unnecessary service_role privileges are revoked from every table", () => {
  for (const table of [
    "mentor_availability_windows",
    "mentor_blackout_periods",
    "administrator_blackout_periods",
    "meeting_requests",
    "notifications",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke select, insert, update, delete, truncate, references, trigger, maintain\\s+on table public\\.${table}\\s+from service_role`,
        "s",
      ),
    );
  }
});

test("availability retains only runtime select, insert, delete and editable-column update", () => {
  assert.match(availabilityRoute, /\.select\(/);
  assert.match(availabilityRoute, /\.insert\(/);
  assert.match(availabilityRoute, /\.update\(/);
  assert.match(availabilityRoute, /\.delete\(/);
  assert.match(
    migration,
    /grant select, insert, delete\s+on table public\.mentor_availability_windows\s+to service_role/s,
  );
  assert.match(
    migration,
    /grant update \(\s*weekday,\s*start_time,\s*end_time,\s*meeting_mode,\s*supported_durations,\s*is_active,\s*effective_start_date,\s*effective_end_date,\s*timezone,\s*updated_at\s*\)\s*on public\.mentor_availability_windows/s,
  );
});

test("mentor and administrator blackouts retain only operations used by loaders and API", () => {
  assert.match(
    migration,
    /grant select, insert, delete\s+on table public\.mentor_blackout_periods\s+to service_role/s,
  );
  assert.match(
    migration,
    /grant select\s+on table public\.administrator_blackout_periods\s+to service_role/s,
  );
  assert.match(meetingData, /from\("administrator_blackout_periods"\)\.select/);
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete)[^\n]*administrator_blackout_periods/i,
  );
});

test("meeting requests retain select, insert and lifecycle-column update only", () => {
  assert.match(meetingRoutes, /\.select\(/);
  assert.match(meetingRoutes, /\.insert\(/);
  assert.match(meetingRoutes, /\.update\(/);
  assert.doesNotMatch(meetingRoutes, /from\("meeting_requests"\)\.delete/);
  assert.match(
    migration,
    /grant select, insert\s+on table public\.meeting_requests\s+to service_role/s,
  );
  assert.match(
    migration,
    /grant update \(\s*status,\s*mentor_response,\s*proposed_start_at,\s*proposed_duration_minutes,\s*responded_at,\s*cancelled_at,\s*requested_end_at,\s*updated_at\s*\)\s*on public\.meeting_requests/s,
  );
});

test("notifications retain select, insert and read_at update only", () => {
  assert.match(notificationSources, /\.select\(/);
  assert.match(notificationSources, /\.insert\(/);
  assert.match(notificationSources, /\.update\(\{ read_at:/);
  assert.doesNotMatch(notificationSources, /from\("notifications"\)\.delete/);
  assert.match(
    migration,
    /grant select, insert\s+on table public\.notifications\s+to service_role/s,
  );
  assert.match(
    migration,
    /grant update \(read_at\)\s+on public\.notifications\s+to service_role/s,
  );
});
test("confirmed interval migration grants only its three lifecycle columns", () => {
  assert.match(
    confirmedIntervalMigration,
    /grant update \(\s*confirmed_start_at,\s*confirmed_end_at,\s*confirmed_duration_minutes\s*\)\s*on public\.meeting_requests\s*to service_role/s,
  );
  assert.doesNotMatch(
    confirmedIntervalMigration,
    /grant (?:all|select|insert|delete|truncate|references|trigger|maintain)|to (?:anon|authenticated)|disable row level security/i,
  );
});