import assert from "node:assert/strict";
import test from "node:test";
import { mapPublishedMentors } from "./public-mentor-core.ts";

const profile = {
  user_id: "private-user-id",
  first_name: "נועה",
  last_name: "כהן",
  city: "רעננה",
  bio: "אוהבת לעזור לילדים להצליח.",
};
const base = {
  profiles: [profile],
  subjects: [{
    user_id: profile.user_id,
    custom_subject: null,
    age_groups: ["ה׳–ו׳"],
    subjects: { name: "מתמטיקה" },
  }],
  experiences: [{
    user_id: profile.user_id,
    experience_types: ["הדרכה"],
    mentoring_types: ["לימודי"],
  }],
  preferences: [{
    user_id: profile.user_id,
    preferred_age_groups: ["חטיבת ביניים"],
    meeting_modes: ["פרונטלי"],
  }],
  availability: [{
    user_id: profile.user_id,
    flexible_availability: true,
    available_on_holidays: false,
    time_preferences: ["אחר הצהריים"],
  }],
};

for (const status of ["approved", "paused", "pending_review", "rejected", "draft"]) {
  test(`${status} mentor is not publicly returned`, () => {
    assert.deepEqual(mapPublishedMentors({
      publications: [{ user_id: profile.user_id, status }],
      ...base,
    }), []);
  });
}

test("published mentor is mapped to a strict safe public object", () => {
  const [mentor] = mapPublishedMentors({
    publications: [{ user_id: profile.user_id, status: "published" }],
    ...base,
  });
  assert.deepEqual(mentor, {
    displayName: "נועה כ׳",
    city: "רעננה",
    subjects: ["מתמטיקה"],
    introduction: "אוהבת לעזור לילדים להצליח.",
    experience: ["הדרכה", "לימודי"],
    ageGroups: ["ה׳–ו׳", "חטיבת ביניים"],
    meetingModes: ["פרונטלי"],
    availability: ["אחר הצהריים", "זמינות גמישה"],
  });
  const serialized = JSON.stringify(mentor);
  for (const forbidden of [
    "user_id", "private-user-id", "birth_date", "email", "phone",
    "parent", "consent", "reviewed", "rejection_reason", "published_by",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
  assert.equal(mentor.displayName, "נועה כ׳");
});
