import assert from "node:assert/strict";
import test from "node:test";
import { MentorAccountControlInputError, parseMentorAccountAction } from "./admin-account-control-core.ts";

test("administrator can parse a permanent block with a documented reason", () => {
  assert.deepEqual(parseMentorAccountAction({ action: "block", reason: "הפרת כללי הבטיחות" }), { action: "block", reason: "הפרת כללי הבטיחות" });
});

test("temporary suspension requires a future end time", () => {
  assert.throws(() => parseMentorAccountAction({ action: "suspend", reason: "בדיקה", suspendedUntil: "2020-01-01" }), MentorAccountControlInputError);
});

test("permanent deletion requires the exact Hebrew confirmation", () => {
  assert.throws(() => parseMentorAccountAction({ action: "permanently_delete", reason: "חשבון בדיקה", confirmation: "מחיקה" }), MentorAccountControlInputError);
  assert.equal(parseMentorAccountAction({ action: "permanently_delete", reason: "חשבון בדיקה", confirmation: "מחיקה לצמיתות" }).action, "permanently_delete");
});
