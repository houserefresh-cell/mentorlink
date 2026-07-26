import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const homepage = read("app/page.tsx");
const header = read("app/_components/PublicHeader.tsx");

test("root route renders the public MentorLink homepage without a redirect", () => {
  assert.match(homepage, /export default function HomePage/);
  assert.match(homepage, /<PublicHeader \/>/);
  assert.match(homepage, /id="mentors"/);
  assert.doesNotMatch(homepage, /redirect\(|router\.replace/);
});

test("logo and public navigation lead to home, mentor registration, and login", () => {
  assert.match(header, /href="\/" aria-label="MentorLink — דף הבית"/);
  assert.match(header, /href="\/register\/mentor"/);
  assert.match(header, /href="\/login"/);
});

test("mobile navigation is keyboard-usable without client-only state", () => {
  assert.match(header, /<details className="relative md:hidden">/);
  assert.match(header, /<summary[^>]*>תפריט<\/summary>/);
  assert.match(header, /aria-label="ניווט ציבורי לנייד"/);
  assert.doesNotMatch(header, /"use client"/);
});

test("example mentor cards cannot be mistaken for live profiles", () => {
  assert.match(homepage, /דוגמאות להמחשה בלבד/);
  assert.match(homepage, /אינם מחוברים למסד הנתונים/);
  assert.match(homepage, /דוגמה בלבד/);
  assert.doesNotMatch(homepage, /supabase|localStorage/);
});

test("public and authentication routes retain a route home", () => {
  for (const path of [
    "app/login/layout.tsx",
    "app/register/layout.tsx",
    "app/auth/layout.tsx",
    "app/parent-consent/verify/layout.tsx",
  ]) {
    assert.match(read(path), /PublicHeader/);
  }
});

test("administrator navigation returns to the public site without exposing admin publicly", () => {
  const adminLayout = read("app/dashboard/admin/layout.tsx");
  assert.match(adminLayout, /href="\/"/);
  assert.doesNotMatch(header, /dashboard\/admin/);
  assert.match(read("lib/admin-authorization.ts"), /authorizeAdministrator/);
});

test("existing registration and authentication route files remain present", () => {
  for (const path of [
    "app/login/page.tsx",
    "app/register/page.tsx",
    "app/register/mentor/page.tsx",
    "app/register/parent/page.tsx",
    "app/auth/callback/page.tsx",
  ]) {
    assert.ok(read(path).length > 0, `${path} should remain loadable`);
  }
});
