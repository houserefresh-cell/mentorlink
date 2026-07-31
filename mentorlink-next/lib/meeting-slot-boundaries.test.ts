import assert from "node:assert/strict";
import test from "node:test";
import {
  generateBookableSlots,
  type AvailabilityWindow,
} from "./meeting-scheduling-core.ts";

const window: AvailabilityWindow = {
  id: "window",
  weekday: 1,
  start_time: "16:00",
  end_time: "18:00",
  meeting_mode: "פרונטלי",
  supported_durations: [30, 60],
  is_active: true,
  effective_start_date: "2026-08-31",
  effective_end_date: "2026-08-31",
  timezone: "Asia/Jerusalem",
};

test("mentor blackout removes overlapping generated slots", () => {
  const baseline = generateBookableSlots({
    windows: [window],
    blackouts: [],
    accepted: [],
    now: new Date("2026-08-30T00:00:00Z"),
    days: 3,
  });
  assert.ok(baseline.length > 0);
  const blocked = generateBookableSlots({
    windows: [window],
    blackouts: [{
      starts_at: baseline[0].startAt,
      ends_at: new Date(new Date(baseline[0].startAt).getTime() + 60 * 60_000).toISOString(),
    }],
    accepted: [],
    now: new Date("2026-08-30T00:00:00Z"),
    days: 3,
  });
  assert.ok(blocked.length < baseline.length);
  assert.ok(!blocked.some((slot) => slot.startAt === baseline[0].startAt));
});

test("accepted meeting removes every overlapping slot but not adjacent slots", () => {
  const baseline = generateBookableSlots({
    windows: [window],
    blackouts: [],
    accepted: [],
    now: new Date("2026-08-30T00:00:00Z"),
    days: 3,
  });
  const acceptedStart = baseline[0].startAt;
  const acceptedEnd = new Date(new Date(acceptedStart).getTime() + 30 * 60_000).toISOString();
  const remaining = generateBookableSlots({
    windows: [window],
    blackouts: [],
    accepted: [{ starts_at: acceptedStart, ends_at: acceptedEnd }],
    now: new Date("2026-08-30T00:00:00Z"),
    days: 3,
  });
  assert.ok(!remaining.some((slot) => slot.startAt === acceptedStart));
  assert.ok(remaining.some((slot) => slot.startAt === acceptedEnd));
});
