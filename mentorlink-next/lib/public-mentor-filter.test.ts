import assert from "node:assert/strict";
import test from "node:test";

import type { PublicMentor } from "./public-mentor-core.ts";
import { ALL_CITIES, filterPublicMentors } from "./public-mentor-filter.ts";

const mentors: PublicMentor[] = [
  {
    bookingId: "booking-public-id",
    displayName: "נועה כ׳",
    city: "רעננה",
    subjects: ["מתמטיקה"],
    introduction: "אוהבת לעזור ולהסביר",
    experience: ["הדרכה"],
    ageGroups: ["חטיבת ביניים"],
    meetingModes: ["פרונטלי"],
    availability: ["אחר הצהריים"],
  },
  {
    bookingId: "booking-public-id",
    displayName: "דניאל ל׳",
    city: "חיפה",
    subjects: ["אנגלית"],
    introduction: null,
    experience: [],
    ageGroups: [],
    meetingModes: [],
    availability: [],
  },
];

test("public mentor filtering preserves free-text and city behavior", () => {
  assert.deepEqual(filterPublicMentors(mentors, "מתמטיקה", ALL_CITIES), [mentors[0]]);
  assert.deepEqual(filterPublicMentors(mentors, "", "חיפה"), [mentors[1]]);
  assert.deepEqual(filterPublicMentors(mentors, "הדרכה", "רעננה"), [mentors[0]]);
  assert.deepEqual(filterPublicMentors(mentors, "אנגלית", "רעננה"), []);
});

test("public mentor filtering is trimmed and case-insensitive", () => {
  assert.deepEqual(filterPublicMentors(mentors, "  דניאל  ", ALL_CITIES), [mentors[1]]);
});
