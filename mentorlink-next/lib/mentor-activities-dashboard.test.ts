import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const manager = read(
  "app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx",
);
const activitiesPage = read("app/dashboard/mentor/activities/page.tsx");
const form = read(
  "app/dashboard/mentor/activities/_components/MentorActivityForm.tsx",
);
const dashboard = read("app/dashboard/mentor/page.tsx");
const api = read("app/api/mentor-activities/route.ts");

test("activities page loads status cards, registration counts and capacity", () => {
  for (const status of ["draft", "published", "cancelled", "completed"]) {
    assert.match(manager, new RegExp(`${status}: \\{ label:`));
  }
  assert.match(manager, /fetch\("\/api\/mentor-activities"/);
  assert.match(manager, /registration_counts\?\.registered/);
  assert.match(manager, /registration_counts\?\.waitlisted/);
  assert.match(manager, /max_participants - registered/);
  assert.match(manager, /nextSession\(activity\.sessions\)/);
  assert.match(api, /subject_name:/);
});

test("draft publication requires explicit confirmation", () => {
  assert.match(manager, /setConfirmAction\(\{ kind, activity \}\)/);
  assert.match(manager, /kind: "publish" \| "cancel" \| "delete"/);
  assert.match(manager, /הפעילות תופיע למשפחות ותהיה פתוחה להרשמה\. לפרסם עכשיו\?/);
  assert.match(manager, /אישור ופרסום/);
  assert.match(manager, /JSON\.stringify\(\{ action: kind, \.\.\.\(kind === "cancel" \? \{ reason \} : \{\}\) \}\)/);
});

test("cancellation and draft deletion require confirmation and match status", () => {
  assert.match(manager, /activity\.status === "published"[\s\S]*onConfirm\("cancel"\)/);
  assert.match(manager, /activity\.status === "draft"[\s\S]*onConfirm\("delete"\)/);
  assert.match(manager, /הפעילות תיסגר להרשמה ותסומן כמבוטלת/);
  assert.match(manager, /הטיוטה וכל המפגשים שלה יימחקו לצמיתות/);
  assert.match(manager, /kind === "delete" \? "DELETE" : "PATCH"/);
});

test("duplicate opens the edit page for the new draft", () => {
  assert.match(manager, /\/duplicate`/);
  assert.match(manager, /method: "POST"/);
  assert.match(manager, /router\.push\(`\/dashboard\/mentor\/activities\/\$\{body\.activity\.id\}\/edit\?duplicated=1`\)/);
  assert.match(manager, /יצירת פעילות חדשה על בסיס זו/);
  assert.match(manager, /תיווצר טיוטה חדשה\. הפעילות המקורית לא תשתנה, ויש לבחור תאריך ושעות חדשים\./);
  assert.match(form, /נוצרה טיוטה חדשה על בסיס הפעילות\. יש לבחור תאריך ושעות לפני הפרסום\./);
});

test("cards and preview emphasize the complete upcoming session", () => {
  assert.ok(manager.includes("<DateHighlight activity={activity} session={next} />"));
  assert.ok(manager.includes("<DateHighlight activity={activity} session={nextSession(activity.sessions)} />"));
  assert.match(manager, /weekday: "long"/);
  assert.match(manager, /day: "numeric", month: "long", year: "numeric"/);
  assert.match(manager, /המפגש הקרוב/);
  assert.match(manager, /מפגשים בסדרה/);
  assert.match(manager, /סיום משוער: עד 5–10 דקות נוספות/);
  assert.match(manager, /סיום משוער: עד 15–20 דקות נוספות/);
  assert.match(manager, /bg-blue-700/);
});
test("cards emphasize hover and keyboard focus without changing grid layout", () => {
  assert.match(manager, /tabIndex=\{0\}/);
  assert.match(manager, /hover:scale-\[1\.025\]/);
  assert.match(manager, /focus-visible:scale-\[1\.025\]/);
  assert.match(manager, /hover:-translate-y-1/);
  assert.match(manager, /hover:z-10/);
  assert.match(manager, /motion-reduce:transform-none/);
  assert.match(manager, /transition-\[transform,box-shadow\]/);
});

test("activity form confirms publication and returns to activities with success", () => {
  assert.match(form, /publishConfirmation/);
  assert.match(form, /חזרה לעריכה/);
  assert.match(form, /אישור ופרסום/);
  assert.match(form, /router\.replace\("\/dashboard\/mentor\/activities\?published=1"\)/);
  assert.match(manager, /get\("published"\) === "1"/);
  assert.match(manager, /הפעילות פורסמה בהצלחה והיא פתוחה להרשמה/);
});

test("shared manager is rendered and existing mentor dashboard systems remain", () => {
  assert.match(activitiesPage, /<MentorActivitiesManager \/>/);
  assert.match(dashboard, /mentor-activities-title/);
  assert.match(dashboard, /\/dashboard\/mentor\/activities\/new/);
  assert.match(dashboard, /\/dashboard\/mentor\/activities"/);
  for (const existing of [
    "mentor-actions-title",
    "mentor-status-title",
    "mentor-quick-title",
    "/dashboard/mentor/meetings",
    "/dashboard/mentor/inquiries",
    "/dashboard/mentor/scheduling",
    "/dashboard/mentor/profile",
  ]) assert.match(dashboard, new RegExp(existing));
});
