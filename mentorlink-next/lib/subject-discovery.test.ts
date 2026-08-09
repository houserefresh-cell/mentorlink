import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { categorySearchTerms, createSubjectSearchHref, MENTOR_DISCOVERY_CATEGORIES } from "./subject-discovery.ts";

test("discovery keeps languages separate from studies", () => {
  const languages = MENTOR_DISCOVERY_CATEGORIES.find((category) => category.title === "שפות");
  const studies = MENTOR_DISCOVERY_CATEGORIES.find((category) => category.title === "לימודים");

  assert.ok(languages);
  assert.ok(studies);
  assert.ok(categorySearchTerms(languages).includes("אנגלית"));
  assert.ok(categorySearchTerms(languages).includes("עברית"));
  assert.equal(categorySearchTerms(studies).includes("אנגלית"), false);
  assert.equal(categorySearchTerms(studies).includes("עברית"), false);
});

test("individual sports include snooker and both table tennis search names", () => {
  const category = MENTOR_DISCOVERY_CATEGORIES.find((item) => item.title === "ספורט יחידני");
  assert.ok(category);
  const terms = categorySearchTerms(category);
  assert.ok(terms.includes("סנוקר"));
  assert.ok(terms.includes("טניס שולחן"));
  assert.ok(terms.includes("פינג פונג"));
  assert.equal(terms.includes("גלישה"), false);
});

test("subject discovery links support broad and exact searches", () => {
  const broad = createSubjectSearchHref("/dashboard/parent", ["טניס", "סנוקר"]);
  const exact = createSubjectSearchHref("/", ["פינג פונג"]);
  assert.match(broad, /^\/dashboard\/parent\?search=1&subject=/);
  assert.match(broad, /subject=%D7%98%D7%A0%D7%99%D7%A1/);
  assert.match(broad, /#mentor-search$/);
  assert.match(exact, /^\/\?search=1&subject=/);
  assert.match(exact, /#mentor-search$/);
});

test("discovery is present on public, parent and mentor entry points", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const parent = readFileSync(new URL("../app/dashboard/parent/page.tsx", import.meta.url), "utf8");
  const mentor = readFileSync(new URL("../app/dashboard/mentor/discover/page.tsx", import.meta.url), "utf8");
  assert.match(home, /<SubjectDiscovery\s*\/>/);
  assert.match(parent, /<SubjectDiscovery targetPath="\/dashboard\/parent"\s*\/>/);
  assert.match(mentor, /<SubjectDiscovery targetPath="\/dashboard\/mentor\/discover"\s*\/>/);
});
