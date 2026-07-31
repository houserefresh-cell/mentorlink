import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const form = read(
  "app/dashboard/mentor/activities/_components/MentorActivityForm.tsx",
);
const newPage = read("app/dashboard/mentor/activities/new/page.tsx");
const editPage = read(
  "app/dashboard/mentor/activities/[activityId]/edit/page.tsx",
);
const subjectsApi = read("app/api/mentor-subjects/route.ts");

test("one-off activity subjects can stay outside the mentor profile", () => {
  assert.match(form, /useState\(false\)/);
  assert.match(form, /addToProfile \}\)/);
  assert.match(form, /הוסף את המקצוע גם לפרופיל שלי/);
  assert.match(subjectsApi, /body\.addToProfile === undefined \? true : body\.addToProfile/);
  assert.match(subjectsApi, /typeof addToProfile !== "boolean"/);
  assert.match(subjectsApi, /addToProfile\s*\?\s*await admin\.from\("mentor_subjects"\)\.upsert/);
  assert.match(subjectsApi, /addedToProfile: addToProfile/);
});

test("one-time activities keep one session while series can add and remove sessions", () => {
  assert.match(form, /format === "one_time" \? \[form\.sessions\[0\] \?\? emptySession\(\)\]/);
  assert.match(form, /form\.format === "series" && form\.sessions\.length > 1/);
  assert.match(form, /sessions: form\.sessions\.filter/);
  assert.match(form, /sessions: \[\.\.\.form\.sessions, emptySession\(\)\]/);
});

test("estimated overrun is stored per session and resets to none", () => {
  assert.match(form, /allowOverrun: e\.target\.checked/);
  assert.match(form, /e\.target\.checked \? "5_10_minutes" : "none"/);
  assert.match(form, /value="15_20_minutes"/);
  assert.match(form, /session\.allowOverrun \? session\.estimatedOverrun : "none"/);
});

test("pickup fields are conditional and disabled pickup sends an empty array", () => {
  assert.match(form, /pickupEnabled: e\.target\.checked/);
  assert.match(form, /pickupOptions: e\.target\.checked \? form\.pickupOptions : \[\]/);
  assert.match(form, /form\.pickupOptions\.includes\("other"\)/);
  assert.match(form, /pickupOptions: value\.pickupEnabled \? value\.pickupOptions : \[\]/);
  assert.match(form, /pickupDetails: value\.pickupEnabled && value\.pickupOptions\.includes\("other"\)/);
});

test("draft and publication use distinct API actions and prevent double submission", () => {
  assert.match(form, /if \(busy \|\| !token \|\| !editable\) return/);
  assert.match(form, /save\("draft"\)/);
  assert.match(form, /save\("publish"\)/);
  assert.match(form, /status: action === "publish" \? "published" : "draft"/);
  assert.match(form, /action: action === "publish" \? "publish" : "edit"/);
  assert.match(form, /router\.replace\(`\/dashboard\/mentor\/activities\/\$\{body\.activity\.id\}\/edit`\)/);
});

test("new and edit pages render the same shared form", () => {
  assert.match(newPage, /import \{ MentorActivityForm \}/);
  assert.match(newPage, /<MentorActivityForm \/>/);
  assert.match(editPage, /import \{ MentorActivityForm \}/);
  assert.match(editPage, /params: Promise<\{ activityId: string \}>/);
  assert.match(editPage, /<MentorActivityForm activityId=\{activityId\} \/>/);
  assert.match(form, /fetch\(`\/api\/mentor-activities\/\$\{activityId\}`/);
});
