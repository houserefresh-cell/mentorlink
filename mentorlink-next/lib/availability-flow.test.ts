import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const editor = read("app/dashboard/mentor/scheduling/page.tsx");
const api = read("app/api/mentor-availability/route.ts");

test("editing availability keeps existing subject links without requiring update privileges", () => {
  assert.match(api, /onConflict: "window_id,subject_id", ignoreDuplicates: true/);
});
const slots = read("app/api/meeting-requests/available-slots/route.ts");
const flow = read("app/_components/MeetingRequestFlow.tsx");
const core = read("lib/meeting-scheduling-core.ts");
const migration = read("supabase/migrations/202607310021_allow_ten_minute_custom_durations.sql");

test("availability saves independently with visible confirmation and safe diagnostics", () => {
  assert.match(editor, /הזמינות נשמרה בהצלחה\./);
  assert.match(editor, /await load\(token\)/);
  assert.match(editor, /AVAILABILITY_SAVE_FAILED|AVAILABILITY_API_FAILED/);
  assert.match(api, /authenticateMeetingUser/);
  assert.match(api, /user\.role !== "mentor"/);
  assert.match(api, /availabilityDiagnostic/);
  assert.doesNotMatch(`${editor}\n${api}`, /pending_review|mentor_public_pending_changes|mentor_publication.*update/s);
});

test("availability supports create edit delete validation and duplicate prevention", () => {
  assert.match(api, /export async function POST/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /export async function DELETE/);
  assert.match(api, /endTime <= startTime/);
  assert.match(api, /DUPLICATE_WINDOW/);
  assert.match(api, /\.neq\("id", id\)/);
  assert.match(editor, /עריכה/); assert.match(editor, /מחיקה/);
});

test("fixed and custom durations are validated end to end", () => {
  assert.match(editor, /\[30, 45, 60, 75, 90\]/);
  assert.match(editor, /משך מותאם אישית/);
  assert.match(core, /value >= 10 && value <= 180/);
  assert.match(migration, /10 <= all\(supported_durations\)/i);
  assert.match(migration, /requested_duration_minutes between 10 and 180/);
});

test("parent sees distinct availability states, controls and later horizon", () => {
  assert.match(slots, /NO_AVAILABILITY/); assert.match(slots, /NO_OPEN_SLOTS/);
  assert.match(flow, /החונך עדיין לא הגדיר מועדים זמינים לפגישה/);
  assert.match(flow, /אין כרגע מועדים פנויים בטווח המוצג/);
  assert.match(flow, /הצגת מועדים מאוחרים יותר/);
  for (const heading of ["א. נושא הפגישה", "ב. אופן הפגישה", "ג. בחירת יום", "ד. משך הפגישה", "ה. פרטי הילד/ה", "ו. במה נדרשת עזרה", "ז. הודעה קצרה לחונך"]) assert.match(flow, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(flow, /hasSelectableSlots && missingRequirements\.length === 0/);
});
