import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const form = read("app/dashboard/mentor/activities/_components/MentorActivityForm.tsx");
const manager = read("app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx");
const itemApi = read("app/api/mentor-activities/[activityId]/route.ts");

test("draft stays available while publication is disabled with a missing-fields list", () => {
  assert.match(form, /onClick=\{\(\) => save\("draft"\)\}/);
  assert.match(form, /publicationMissing\(form\)/);
  assert.match(form, /כדי לפרסם יש להשלים:/);
  assert.match(form, /missingForPublication\.length > 0/);
  assert.match(form, /\* שדה חובה לפרסום הפעילות/);
  assert.match(form, /\(לא חובה\)/);
  assert.match(form, /ביטול וחזרה/);
});

test("weekly series generation starts from the first editable session", () => {
  assert.match(form, /weeklyCount/);
  assert.match(form, /generateWeeklySessions/);
  assert.match(form, /index \* 7/);
  assert.match(form, /יצירת המועדים השבועיים/);
  assert.match(form, /updateSession\(index/);
});

test("audience, equipment and accessibility defaults are explicit in details", () => {
  assert.match(manager, /מתאים לכל הגילים\./);
  assert.match(manager, /לא נדרש להביא ציוד\./);
  assert.match(manager, /כל מועדי הפעילות/);
  assert.match(manager, /accessibilityText/);
  assert.match(manager, /לא סומנו התאמות נגישות/);
  assert.match(form, /לא ידוע – מומלץ ליצור קשר לפני ההרשמה/);
});

test("cards are equal-height summaries and destructive actions stay separated", () => {
  assert.match(manager, /auto-rows-fr/);
  assert.match(manager, /flex h-full flex-col/);
  assert.match(manager, /line-clamp-2/);
  assert.match(manager, /mt-auto flex flex-wrap/);
  assert.match(manager, /w-full border-t border-red-200/);
});

test("cancelled activity deletion is allowed only after registration check", () => {
  assert.match(itemApi, /\["draft", "cancelled"\]\.includes/);
  assert.match(itemApi, /mentor_activity_registrations/);
  assert.match(itemApi, /ACTIVITY_HAS_REGISTRATIONS/);
  assert.match(itemApi, /\.in\("status", \["draft", "cancelled"\]\)/);
});
