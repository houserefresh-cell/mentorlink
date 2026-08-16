import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("mentor administration does not depend on the deleted-account archive to load", () => {
  const data = read("lib/admin-mentor-data.ts");
  const route = read("app/api/admin/mentors/route.ts");
  assert.doesNotMatch(data, /from\("admin_deleted_accounts"\)/);
  assert.match(route, /activeIds/);
  assert.match(route, /publicationMentors: publicationMentors\.filter[\s\S]*registrations,/);
});

test("restoring a removed child preserves the archived profile and preferences", () => {
  const route = read("app/api/parent/children/route.ts");
  const restoreBlock = route.slice(route.indexOf("if (removedMatch.data)"), route.indexOf("const result = await admin.rpc", route.indexOf("if (removedMatch.data)")));
  assert.match(restoreBlock, /removed_at: null/);
  assert.doesNotMatch(restoreBlock, /save_parent_child_preferences/);
  assert.doesNotMatch(restoreBlock, /default_mentor_message:/);
});

test("meeting cards expose the child and full meeting context to both roles", () => {
  const panel = read("app/dashboard/_components/MeetingRequestsPanel.tsx");
  const route = read("app/api/meeting-requests/route.ts");
  for (const label of ["עבור", "מטרת המפגש:", "הודעת ההורה:", "תשובת החונך:", "הכנה למפגש:", "מה להביא:", "מיקום או קישור:", "משתתפים נוספים:"]) {
    assert.match(panel, new RegExp(label));
  }
  assert.match(panel, /displayedStart/);
  assert.match(panel, /בקשת פגישה — עדיין לא אושרה/);
  assert.match(panel, /href=\{`tel:/);
  assert.match(panel, /https:\/\/wa\.me/);
  assert.match(route, /contact_phone:/);
});

test("account deletion remains effective when the optional archive mirror fails", () => {
  const parents = read("app/api/admin/parents/route.ts");
  const mentors = read("lib/admin-account-control.ts");
  for (const source of [parents, mentors]) {
    assert.ok(source.indexOf("updateUserById") < source.indexOf('from("admin_deleted_accounts").upsert'));
    assert.match(source, /administrative_deletion/);
    assert.match(source, /console\.error\("Unable to mirror deleted/);
  }
});

test("account action failures are rendered next to the parent account controls", () => {
  const page = read("app/dashboard/admin/parents/page.tsx");
  assert.match(page, /setActionError/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /else alert\(/);
});
