import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getMentorCapabilities,
  isAllowedMentorActivityPrice,
  isAllowedMentorMeetingPrice,
} from "./mentor-age.ts";

test("mentor capabilities change automatically at the eighteenth birthday", () => {
  const before = getMentorCapabilities("2008-09-01", new Date("2026-08-31T12:00:00Z"));
  const adult = getMentorCapabilities("2008-09-01", new Date("2026-09-01T12:00:00Z"));
  assert.equal(before.isAdult, false);
  assert.equal(adult.isAdult, true);
  assert.equal(before.requiresParentConsent, true);
  assert.equal(adult.requiresParentConsent, false);
});

test("minor meeting and activity prices use the requested caps while adults are uncapped by product policy", () => {
  const minor = getMentorCapabilities("2010-01-01", new Date("2026-08-30T12:00:00Z"));
  const adult = getMentorCapabilities("2000-01-01", new Date("2026-08-30T12:00:00Z"));
  assert.equal(isAllowedMentorMeetingPrice(40, minor), true);
  assert.equal(isAllowedMentorMeetingPrice(41, minor), false);
  assert.equal(isAllowedMentorMeetingPrice(125.5, adult), true);
  assert.equal(isAllowedMentorActivityPrice(25, minor), true);
  assert.equal(isAllowedMentorActivityPrice(25.01, minor), false);
  assert.equal(isAllowedMentorActivityPrice(250, adult), true);
});

test("marketplace batch keeps the requested UI and DB guards wired", async () => {
  const [meetingFlow, manager, migration, parentSubjects] = await Promise.all([
    readFile(new URL("../app/_components/MeetingRequestFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/mentor/activities/_components/MentorActivitiesManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260901020000_dynamic_mentor_pricing_and_categories.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/parent/subjects/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(meetingFlow, /weekday: "long"/);
  assert.match(meetingFlow, /year: "2-digit"/);
  assert.match(manager, /"current", label: "פעילויות חדשות"/);
  assert.match(migration, /meeting_price >= 0/);
  assert.doesNotMatch(migration, /meeting_price in \(0, 10, 20, 30\)/);
  assert.match(parentSubjects, /loadSlots/);
  assert.match(parentSubjects, /mentor_activities/);
});
