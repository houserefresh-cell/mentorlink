import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const notifications = read("app/api/notifications/route.ts");
const mentorShell = read("app/dashboard/mentor/_components/MentorDashboardShell.tsx");
const parentMeetingUpdates = read("app/dashboard/parent/requests/ParentMeetingUpdates.tsx");
const migration = read("supabase/migrations/202608210045_rich_attention_and_cross_schedule_guards.sql");

test("mentor notices contain inline meeting and activity details without a details link", () => {
  assert.match(notifications, /registration=\(\[0-9a-f-\]\{36\}\)/);
  assert.match(notifications, /parentName/);
  assert.match(notifications, /activityTitle/);
  assert.match(mentorShell, /ImportantNoticeDetailsBox/);
  assert.doesNotMatch(mentorShell, />פתיחת הפרטים</);
});

test("activity registration notifications distinguish registration from cancellation", () => {
  assert.match(migration, /'הרשמה חדשה לפעילות'/);
  assert.match(migration, /'ביטול הרשמה לפעילות'/);
  assert.match(migration, /registration=%s/);
});

test("parent meeting updates include approval and a full inline detail box", () => {
  assert.match(migration, /update_type in \('cancellation', 'details', 'reschedule', 'approval'\)/);
  assert.match(migration, /'החונך אישר את הפגישה\.'/);
  for (const label of ["חונך/ת", "ילד/ה", "נושא ותחום", "יום, תאריך ושעה", "מיקום"]) {
    assert.ok(parentMeetingUpdates.includes(label));
  }
});
