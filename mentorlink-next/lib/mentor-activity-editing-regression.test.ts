import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/202607310025_fix_published_activity_editing.sql");
const api = read("app/api/mentor-activities/[activityId]/route.ts");
const form = read("app/dashboard/mentor/activities/_components/MentorActivityForm.tsx");

test("published activities without active registrations remain fully editable atomically", () => {
  assert.match(migration, /v_existing_status not in \('draft', 'published'\)/);
  assert.match(migration, /v_should_publish := v_should_publish or v_existing_status = 'published'/);
  assert.match(migration, /status in \('draft', 'published'\)/);
  assert.doesNotMatch(migration, /set status = 'draft'/);
  assert.doesNotMatch(migration, /save_mentor_activity_022/);
  assert.match(api, /\.rpc\("save_mentor_activity"/);
});

for (const registrationStatus of ["registered", "waitlisted"]) {
  test(`${registrationStatus} registrations lock activity editing in API, RPC and UI`, () => {
    assert.match(migration, new RegExp(`status in \\('registered', 'waitlisted'\\)`));
    assert.match(api, /\.in\("status", \["registered", "waitlisted"\]\)/);
    assert.match(api, /ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS/);
    assert.match(form, /if \(editLocked\) return/);
    assert.match(form, /לפעילות זו כבר קיימות הרשמות ולכן פרטיה המרכזיים נעולים/);
  });
}

test("activity details dialog supports close button, Escape and focus restoration", () => {
  const manager = read("app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx");
  assert.match(manager, /aria-label="סגירת חלון פרטי הפעילות"/);
  assert.match(manager, /event\.key === "Escape"/);
  assert.match(manager, /previewTrigger\.current\?\.focus\(\)/);
  assert.match(manager, /sticky top-0/);
  assert.match(manager, /<ActivityInfoGrid items=\{items\}/);
  assert.match(form, /<ActivityInfoGrid items=\{previewItems\}/);
});
