import assert from "node:assert/strict";
import test from "node:test";
import {
  CITY_LOOKUP,
  findCityMatches,
  normalizeCityKey,
} from "./israeli-cities.ts";

test("official city catalog includes canonical Israeli localities", () => {
  assert.ok(CITY_LOOKUP.has("הוד השרון"));
  assert.ok(CITY_LOOKUP.has("תל אביב-יפו"));
  assert.ok(CITY_LOOKUP.has("ירושלים"));
});

test("city lookup accepts canonical and normalized variants", () => {
  assert.equal(normalizeCityKey("הוד השרון"), "הוד השרון");
  assert.equal(normalizeCityKey("הוד השרון "), "הוד השרון");
  assert.equal(normalizeCityKey("הרצליה"), "הרצליה");
  assert.ok(findCityMatches("הוד").includes("הוד השרון"));
  assert.ok(findCityMatches("תל אביב").includes("תל אביב-יפו"));
});
