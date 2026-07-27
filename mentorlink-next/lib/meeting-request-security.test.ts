import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const createRoute = read("app/api/meeting-requests/route.ts");
const actionRoute = read("app/api/meeting-requests/[requestId]/route.ts");
const availabilityRoute = read("app/api/mentor-availability/route.ts");
const migration = read(
  "supabase/migrations/202607270010_create_parent_mentor_meeting_requests.sql",
);

test("meeting creation authenticates and authorizes a parent before service-role data access", () => {
  assert.ok(
    createRoute.indexOf("authenticateMeetingUser") <
      createRoute.indexOf("createSupabaseAdmin"),
  );
  assert.match(createRoute, /user\.role !== "parent"/);
  assert.match(createRoute, /Published mentor not found/);
  assert.match(createRoute, /mentor\.subjects\.includes\(subject\)/);
  assert.match(createRoute, /mentor\.meetingModes\.includes\(meetingMode\)/);
  assert.match(createRoute, /isCurrentGeneratedSlot/);
  assert.match(createRoute, /idempotency_key/);
  assert.match(createRoute, /23505/);
});

test("meeting actions enforce ownership, conditional transitions, availability and Yom Kippur", () => {
  assert.match(actionRoute, /ownerId !== user\.id/);
  assert.match(actionRoute, /canTransition/);
  assert.match(actionRoute, /\.eq\("status", current\.status\)/);
  assert.match(actionRoute, /overlapsYomKippur/);
  assert.match(actionRoute, /loadSlots/);
  assert.match(actionRoute, /publication\.data\?\.status !== "published"/);
  assert.match(actionRoute, /23P01/);
});

test("availability management is mentor-only and owner-scoped", () => {
  assert.match(availabilityRoute, /user\.role !== "mentor"/);
  assert.match(availabilityRoute, /\.eq\("mentor_user_id", user\.id\)/);
  assert.match(availabilityRoute, /Asia\/Jerusalem/);
  assert.match(availabilityRoute, /isMeetingDuration/);
  assert.match(availabilityRoute, /MEETING_MODES/);
});

test("migration defines narrow RLS ownership and accepted-overlap protection", () => {
  assert.match(migration, /enable row level security/g);
  assert.match(
    migration,
    /parent_user_id = auth\.uid\(\) or mentor_user_id = auth\.uid\(\)/,
  );
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /administrator_blackout_periods/);
  assert.match(read("lib/meeting-data.ts"), /administrator_blackout_periods/);
  assert.match(migration, /meeting_requests_no_accepted_overlap/);
  assert.match(migration, /where \(status = 'accepted'\)/);
  assert.doesNotMatch(migration, /grant all|grant .* to anon/i);
});

test("service credentials and delivery secrets stay in server-only modules", () => {
  assert.match(read("lib/meeting-auth.ts"), /server-only/);
  assert.match(read("lib/meeting-data.ts"), /server-only/);
  assert.match(read("lib/meeting-notifications.ts"), /server-only/);
  assert.doesNotMatch(
    read("app/_components/MeetingRequestFlow.tsx"),
    /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/,
  );
});

test("failed delivery cannot roll back a saved request", () => {
  assert.ok(
    createRoute.indexOf('from("meeting_requests").insert') <
      createRoute.indexOf("await createMeetingNotification"),
  );
  assert.ok(
    createRoute.indexOf("await createMeetingNotification") <
      createRoute.indexOf("await sendMeetingEmail"),
  );
  assert.match(read("lib/meeting-notifications.ts"), /catch \{/);
});
