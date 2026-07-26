import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/_components/PublicMentorDirectory.tsx", import.meta.url),
  "utf8",
);

test("directory uses a bounded responsive one, two, and three-column grid", () => {
  assert.match(source, /mx-auto w-full max-w-6xl/);
  assert.match(source, /grid-cols-1/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /xl:grid-cols-3/);
  assert.match(source, /min-w-0/);
});

test("directory exposes accessible filters and a live Hebrew result count", () => {
  assert.match(source, /htmlFor="mentor-search"/);
  assert.match(source, /id="mentor-search"/);
  assert.match(source, /htmlFor="mentor-city"/);
  assert.match(source, /id="mentor-city"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /חונכים נמצאו/);
});

test("optional card sections are omitted when their values are empty", () => {
  assert.match(source, /if \(!values\.length\) return null/);
  for (const label of [
    "מתאים לגילאים",
    "סוג החונכות",
    "אופן המפגש",
    "זמינות כללית",
  ]) {
    assert.match(source, new RegExp(label));
  }
});
