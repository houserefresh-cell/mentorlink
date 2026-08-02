import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/202608010028_enforce_safe_mentor_registration.sql", import.meta.url), "utf8");

test("review submission requires minimum age ten", () => assert.match(migration, /interval '10 years'/));
test("review submission requires verified email", () => assert.match(migration, /email_confirmed_at[\s\S]*is null/));
test("minor review submission still requires approved parent consent", () => assert.match(migration, /interval '18 years'[\s\S]*approved/));
