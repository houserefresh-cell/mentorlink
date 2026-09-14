import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("migration adds additive audience and availability source fields with legacy public defaults", () => {
  const sql = read("supabase/migrations/202609140047_add_availability_activity_audiences.sql");
  assert.match(sql, /mentor_availability_windows[\s\S]*location text/);
  assert.match(sql, /audience_scope text not null default 'all'/);
  assert.match(sql, /community_ids uuid\[\] not null default/);
  assert.match(sql, /source_availability_id uuid/);
  assert.match(sql, /mentor_activities[\s\S]*audience_scope/);
});

test("availability UI defaults new windows to in-person and exposes audience, location, cards and real meeting history", () => {
  const page = read("app/dashboard/mentor/scheduling/page.tsx");
  assert.match(page, /meetingMode: "פרונטלי"/);
  assert.match(page, /למי הזמינות פתוחה/);
  assert.match(page, /communityIds/);
  assert.match(page, /זמינויות לא פעילות/);
  assert.match(page, /window\.meetings/);
});

test("meeting creation enforces community membership and stores source availability", () => {
  const route = read("app/api/meeting-requests/route.ts");
  assert.match(route, /community_memberships/);
  assert.match(route, /status", "active"/);
  assert.match(route, /source_availability_id: selectedSlot\.id/);
});

test("activity form and APIs expose and enforce per-activity audience", () => {
  const form = read("app/dashboard/mentor/activities/_components/MentorActivityForm.tsx");
  const collection = read("app/api/mentor-activities/route.ts");
  const item = read("app/api/mentor-activities/[activityId]/route.ts");
  const discovery = read("app/api/parent/activities/route.ts");
  const registration = read("app/api/parent/activity-registrations/route.ts");
  assert.match(form, /למי הפעילות פתוחה/);
  assert.match(form, /audienceScope/);
  assert.match(collection, /validateMentorAudience/);
  assert.match(item, /validateMentorAudience/);
  assert.match(discovery, /community_memberships/);
  assert.match(registration, /community_memberships/);
});
