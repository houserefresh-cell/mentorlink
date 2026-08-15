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
  for (const label of ["עבור", "מטרת המפגש:", "הודעת ההורה:", "תשובת החונך:", "הכנה למפגש:", "מה להביא:", "מיקום או קישור:", "משתתפים נוספים:"]) {
    assert.match(panel, new RegExp(label));
  }
  assert.match(panel, /displayedStart/);
  assert.match(panel, /בקשת פגישה — עדיין לא אושרה/);
});

test("account action failures are rendered next to the parent account controls", () => {
  const page = read("app/dashboard/admin/parents/page.tsx");
  assert.match(page, /setActionError/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /else alert\(/);
});
