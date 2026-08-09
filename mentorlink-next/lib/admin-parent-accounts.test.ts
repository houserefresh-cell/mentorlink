import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const api = fs.readFileSync("app/api/admin/parents/route.ts", "utf8");
const page = fs.readFileSync("app/dashboard/admin/parents/page.tsx", "utf8");
const layout = fs.readFileSync("app/dashboard/admin/layout.tsx", "utf8");
const support = fs.readFileSync("app/_components/RegistrationSupport.tsx", "utf8");
const parentRegistration = fs.readFileSync("app/register/parent/page.tsx", "utf8");

test("parent directory authorizes the administrator before creating a service-role client", () => {
  assert.ok(api.indexOf("authorizeAdministrator") < api.indexOf("createSupabaseAdmin()"));
  assert.match(api, /listUsers/);
  assert.match(api, /user_metadata\?\.role === "parent"/);
});

test("parent directory includes parent profiles, children and interests", () => {
  assert.match(api, /parent_profiles/);
  assert.match(api, /parent_children/);
  assert.match(api, /parent_child_subject_interests/);
  assert.match(page, /חשבונות הורים, פרטי קשר והילדים/);
  assert.match(page, /תחומי עניין/);
});

test("administrator navigation and mentor registration expose the requested actions", () => {
  assert.match(layout, /dashboard\/admin\/parents/);
  assert.match(layout, />הורים</);
  assert.match(support, /פנייה למנהל/);
  assert.match(support, /052-224-5128/);
  assert.match(parentRegistration, /<RegistrationSupport compact \/>/);
});
