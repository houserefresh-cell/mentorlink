import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const createRoute = read("app/api/admin/mentors/route.ts");
const onboarding = read("app/dashboard/mentor/onboarding/page.tsx");
const adminRecord = read("app/dashboard/admin/mentors/_components/AdminMentorsClient.tsx");
const migration = read("supabase/migrations/20260827190054_managed_mentor_direct_approval.sql");

test("administrator-created mentors enter the approved publication state", () => {
  assert.match(createRoute, /created_by_administrator: true/);
  assert.match(createRoute, /status: "approved"/);
  assert.match(migration, /created_by_administrator boolean not null default false/);
  assert.match(migration, /then 'approved'/);
});

test("managed mentor onboarding ends without another administrator submission", () => {
  assert.match(onboarding, /אין צורך בשליחה נוספת למנהל/);
  assert.match(onboarding, /לאחר שההורה יאשר דרך הקישור שנשלח אליו, תהליך ההרשמה שלך יסתיים/);
});

test("administrator mentor record exposes verified parent contact details", () => {
  for (const field of ["parent_name", "parent_relationship", "parent_phone", "parent_email", "consented_at"]) {
    assert.match(adminRecord, new RegExp(field));
  }
  assert.match(adminRecord, /ההורה אישר/);
});
