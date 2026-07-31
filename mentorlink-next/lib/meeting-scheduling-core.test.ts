import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransition,
  generateBookableSlots,
  isCurrentGeneratedSlot,
  meetingEndAt,
  type AvailabilityWindow,
} from "./meeting-scheduling-core.ts";

const window: AvailabilityWindow = {
  id: "window",
  weekday: 1,
  start_time: "16:00",
  end_time: "18:00",
  meeting_mode: "אונליין",
  supported_durations: [30, 60, 90],
  is_active: true,
  effective_start_date: null,
  effective_end_date: null,
  timezone: "Asia/Jerusalem",
  subjects: ["מתמטיקה"],
};

test("slots come only from active availability and durations that fit", () => {
  const slots = generateBookableSlots({
    windows: [window],
    blackouts: [],
    accepted: [],
    now: new Date("2026-08-30T00:00:00Z"),
    days: 3,
  });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => slot.meetingMode === "אונליין"));
  const last = slots.at(-1)!;
  assert.ok(!last.durations.includes(90));
  assert.equal(isCurrentGeneratedSlot(slots, slots[0].startAt, "אונליין", 30), true);
  assert.equal(isCurrentGeneratedSlot(slots, slots[0].startAt, "אונליין", 30, "מתמטיקה"), true);
  assert.equal(isCurrentGeneratedSlot(slots, slots[0].startAt, "אונליין", 30, "אנגלית"), false);
  assert.equal(isCurrentGeneratedSlot(slots, slots[0].startAt, "פרונטלי", 30), false);
});

test("custom meeting durations accept every whole minute from ten", () => {
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 9), null);
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 10)?.toISOString(), "2026-08-10T12:10:00.000Z");
  assert.equal(meetingEndAt("2026-08-10T12:00:00.000Z", 24)?.toISOString(), "2026-08-10T12:24:00.000Z");
});

test("blocked, accepted-overlap, past and Yom Kippur slots are excluded", () => {
  const yomKippurWindow = { ...window, effective_start_date: "2026-09-21", effective_end_date: "2026-09-21" };
  const slots = generateBookableSlots({
    windows: [yomKippurWindow],
    blackouts: [],
    accepted: [],
    now: new Date("2026-09-19T00:00:00Z"),
    days: 4,
  });
  assert.deepEqual(slots, []);
});

test("meeting lifecycle rejects stale or unauthorized transitions", () => {
  assert.equal(canTransition("mentor", "pending", "accept"), true);
  assert.equal(canTransition("mentor", "accepted", "decline"), false);
  assert.equal(canTransition("parent", "pending", "cancel"), true);
  assert.equal(canTransition("parent", "alternative_proposed", "cancel"), false);
  assert.equal(canTransition("parent", "alternative_proposed", "accept_alternative"), true);
  assert.equal(canTransition("parent", "alternative_proposed", "decline_alternative"), true);
  assert.equal(canTransition("parent", "accepted", "accept_alternative"), false);
});
