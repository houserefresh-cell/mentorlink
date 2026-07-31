import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/dashboard/mentor/meetings/page.tsx");
const panel = read("app/dashboard/_components/MeetingRequestsPanel.tsx");
const dashboard = read("app/dashboard/mentor/page.tsx");

test("mentor meeting page validates an explicit query view", () => {
  assert.match(page, /searchParams: Promise<\{ view\?: string \}>/);
  for (const view of ["mentor-action", "waiting-parent", "upcoming-approved", "history"]) {
    assert.match(page, new RegExp(`"${view}"`));
  }
  assert.match(page, /<MeetingRequestsPanel role="mentor" view=\{selected\}/);
});

test("mentor panel renders only the selected category with matching title", () => {
  assert.match(panel, /MENTOR_VIEWS\[view\]\.title/);
  assert.match(panel, /mentorViewRequests\(mentorGroups, view\)/);
  assert.match(panel, /if \(view === "mentor-action"\)/);
  assert.match(panel, /if \(view === "waiting-parent"\)/);
  assert.match(panel, /if \(view === "upcoming-approved"\)/);
  assert.doesNotMatch(panel, /id="mentor-action"/);
});

test("dashboard cards use query filters instead of scroll hashes", () => {
  assert.match(dashboard, /meetings\?view=mentor-action/);
  assert.match(dashboard, /meetings\?view=waiting-parent/);
  assert.match(dashboard, /meetings\?view=upcoming-approved/);
  assert.doesNotMatch(dashboard, /meetings#(?:mentor-action|waiting-parent|upcoming-approved)/);
});
