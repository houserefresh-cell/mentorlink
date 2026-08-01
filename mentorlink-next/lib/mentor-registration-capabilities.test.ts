import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityData = readFileSync(new URL("./mentor-activity-data.ts", import.meta.url), "utf8");

test("activity APIs require a published mentor", () => {
  assert.match(activityData, /mentor_publication/);
  assert.match(activityData, /status !== "published"/);
  assert.match(activityData, /MENTOR_NOT_PUBLISHED/);
});
