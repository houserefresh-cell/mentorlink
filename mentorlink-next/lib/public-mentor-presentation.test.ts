import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/_components/PublicMentorDirectory.tsx", import.meta.url), "utf8");

test("compact directory centers fixed-width cards in an auto-fitting grid", () => {
  assert.match(source, /max-w-7xl/);
  assert.match(source, /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,17rem\),17\.5rem\)\)\]/);
  assert.match(source, /justify-center/);
  assert.match(source, /overflow-x-clip/);
  assert.match(source, /min-w-0/);
});

test("every subject is rendered directly as a wrapping, unmodified tag", () => {
  assert.match(source, /mentor\.subjects\.map\(\(subject\)/);
  assert.match(source, /\{subject\}/);
  assert.match(source, /flex-wrap gap-1\.5/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(source, /subjects\.slice|subject\.slice|"\+N"/);
});

test("compact card contains only concise comparison information", () => {
  assert.match(source, /label="מתאים לגילאים"/);
  assert.match(source, /label="אופן המפגש"/);
  assert.match(source, /line-clamp-2/);
  assert.match(source, /slice\(0, 87\)/);
  assert.match(source, />\s*לפרטים\s*</);
  assert.doesNotMatch(source.match(/<article[\s\S]*?<\/article>/)?.[0] ?? "", /זמינות כללית|ניסיון וסוגי חונכות/);
});

test("missing optional biography does not render an empty block", () => {
  assert.match(source, /\{shortIntroduction &&/);
  assert.match(source, /\{mentor\.introduction &&/);
});

test("details dialog uses only safe public fields", () => {
  assert.match(source, /mentor: PublicMentor/);
  assert.match(source, /mentor\.introduction/);
  assert.match(source, /mentor\.experience/);
  assert.match(source, /mentor\.availability/);
  assert.doesNotMatch(source, /user_id|birth_date|email|phone|parent|consent|reviewed|rejection_reason|published_by/);
});

test("native details dialog supports Escape, accessible naming, and focus return", () => {
  assert.match(source, /<dialog/);
  assert.match(source, /\.showModal\(\)/);
  assert.match(source, /\.close\(\)/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-labelledby={titleId}/);
  assert.match(source, /aria-label="סגירת פרטי החונך"/);
  assert.match(source, /onClose={onClosed}/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
});

test("filters and live result count remain accessible on mobile", () => {
  assert.match(source, /htmlFor="mentor-search"/);
  assert.match(source, /htmlFor="mentor-city"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /חונכים נמצאו/);
  assert.match(source, /min-h-12/);
  assert.match(source, /w-\[min\(calc\(100%_-_2rem\),34rem\)\]/);
});
