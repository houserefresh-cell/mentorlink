import assert from "node:assert/strict";
import test from "node:test";
import {
  ISRAEL_TIME_ZONE,
  YOM_KIPPUR_MESSAGE,
  israelLocalDateTimeToUtc,
  overlapsYomKippur,
  yomKippurDate,
} from "./israel-calendar.ts";

test("Yom Kippur is calculated for each Gregorian year in Israel", () => {
  assert.equal(yomKippurDate(2025), "2025-10-02");
  assert.equal(yomKippurDate(2026), "2026-09-21");
  assert.equal(yomKippurDate(2027), "2027-10-11");
  assert.equal(ISRAEL_TIME_ZONE, "Asia/Jerusalem");
});

test("Yom Kippur observance is blocked and unrelated remembrance dates are not", () => {
  const blockedStart = israelLocalDateTimeToUtc("2026-09-20", "18:00");
  const blockedEnd = israelLocalDateTimeToUtc("2026-09-20", "19:00");
  assert.equal(overlapsYomKippur(blockedStart, blockedEnd), true);
  const octoberSeven = israelLocalDateTimeToUtc("2026-10-07", "18:00");
  assert.equal(overlapsYomKippur(octoberSeven, new Date(octoberSeven.getTime() + 3_600_000)), false);
  assert.equal(YOM_KIPPUR_MESSAGE, "לא ניתן לקבוע פגישות ביום כיפור.");
});
