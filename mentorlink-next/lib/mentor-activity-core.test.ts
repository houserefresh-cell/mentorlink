import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionActivity, periodsOverlap, validateActivityInput } from "./mentor-activity-core.ts";

const now = new Date("2026-08-01T00:00:00.000Z");
const complete = {
  subjectId: 4, title: "סדנת רובוטיקה", description: "בנייה ותכנות של רובוט בקבוצה קטנה.",
  format: "series", locationType: "community_center", venueName: "המתנ״ס העירוני",
  address: "רחוב הדוגמה 1", minParticipants: 3, maxParticipants: 12,
  suitableGrades: ["grade_7", "grade_8"], isFree: false, price: 75,
  registrationDeadline: "2026-08-09T12:00:00.000Z",
  pickupOptions: ["school", "other"], pickupDetails: "איסוף מהשער הצפוני",
  sessions: [{ startsAt: "2026-08-10T12:00:00.000Z", endsAt: "2026-08-10T13:30:00.000Z", estimatedOverrun: "5_10_minutes" }],
};

test("draft validation cleans partial data without publication requirements", () => {
  const result = validateActivityInput({ title: "טיוטה", pickupOptions: [] }, "draft", now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.activity.title, "טיוטה");
    assert.equal(result.activity.description, null);
    assert.equal(result.activity.registration_deadline, null);
    assert.deepEqual(result.sessions, []);
  }
});

test("published activity requires complete fields and a future valid session", () => {
  assert.equal(validateActivityInput(complete, "published", now).ok, true);
  const missing = validateActivityInput({ ...complete, description: null }, "published", now);
  assert.deepEqual(missing.ok ? null : missing.code, "PUBLISH_INCOMPLETE");
  const past = validateActivityInput({ ...complete, sessions: [{ startsAt: "2026-07-01T10:00:00Z", endsAt: "2026-07-01T11:00:00Z" }] }, "published", now);
  assert.deepEqual(past.ok ? null : past.code, "NO_FUTURE_SESSION");
});

test("published activities may target all ages without age or grade fields", () => {
  const result = validateActivityInput({
    ...complete,
    minimumAge: null,
    maximumAge: null,
    suitableGrades: [],
  }, "published", now);
  assert.equal(result.ok, true);
});

test("structured accessibility is validated and serialized for atomic storage", () => {
  const valid = validateActivityInput({
    ...complete,
    accessibilityOptions: ["wheelchair", "other"],
    accessibilityOther: "כניסה דרך המעלית הצפונית",
  }, "published", now);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.match(valid.activity.accessibility ?? "", /wheelchair/);

  const unknownCombined = validateActivityInput({
    ...complete,
    accessibilityOptions: ["unknown", "wheelchair"],
  }, "published", now);
  assert.deepEqual(unknownCombined.ok ? null : unknownCombined.code, "INVALID_ACCESSIBILITY");

  const missingOther = validateActivityInput({
    ...complete,
    accessibilityOptions: ["other"],
  }, "published", now);
  assert.deepEqual(missingOther.ok ? null : missingOther.code, "INVALID_ACCESSIBILITY");
});
test("sessions, deadline, price and pickup details are validated", () => {
  const reversed = validateActivityInput({ ...complete, sessions: [{ startsAt: "2026-08-10T13:00:00Z", endsAt: "2026-08-10T12:00:00Z" }] }, "published", now);
  assert.deepEqual(reversed.ok ? null : reversed.code, "INVALID_SESSION");
  const deadline = validateActivityInput({ ...complete, registrationDeadline: "2026-08-10T12:00:00Z" }, "published", now);
  assert.deepEqual(deadline.ok ? null : deadline.code, "INVALID_DEADLINE");
  const price = validateActivityInput({ ...complete, isFree: true, price: 10 }, "published", now);
  assert.deepEqual(price.ok ? null : price.code, "INVALID_PRICE");
  const pickup = validateActivityInput({ ...complete, pickupOptions: ["school"], pickupDetails: "שער אחורי" }, "published", now);
  assert.deepEqual(pickup.ok ? null : pickup.code, "INVALID_PICKUP");
});

test("status transitions and overlap boundaries are safe", () => {
  assert.equal(canTransitionActivity("draft", "published"), true);
  assert.equal(canTransitionActivity("draft", "cancelled"), false);
  assert.equal(canTransitionActivity("published", "cancelled"), true);
  assert.equal(canTransitionActivity("cancelled", "published"), false);
  assert.equal(periodsOverlap("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "2026-08-10T10:30:00Z", "2026-08-10T12:00:00Z"), true);
  assert.equal(periodsOverlap("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", "2026-08-10T11:00:00Z", "2026-08-10T12:00:00Z"), false);
});
