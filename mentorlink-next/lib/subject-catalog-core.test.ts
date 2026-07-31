import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSubjectName,
  subjectComparisonKey,
  validateProposedSubject,
} from "./subject-catalog-core.ts";

test("normalizes whitespace and unsupported punctuation", () => {
  assert.equal(normalizeSubjectName("  כדורגל   !!!  "), "כדורגל");
});

test("detects equivalent and near-duplicate subjects", () => {
  assert.equal(subjectComparisonKey("בינה-מלאכותית"), "בינהמלאכותית");
  assert.equal(validateProposedSubject("כדורגל", ["כדורגל"]).code, "DUPLICATE");
  assert.equal(validateProposedSubject("כדורגלל", ["כדורגל"]).code, "DUPLICATE");
});

test("accepts a meaningful new subject", () => {
  assert.deepEqual(validateProposedSubject("אסטרונומיה", ["מדעים"]), {
    ok: true,
    name: "אסטרונומיה",
    normalizedName: "אסטרונומיה",
  });
});

test("rejects single letters and generic meaningless labels", () => {
  assert.equal(validateProposedSubject("X", []).code, "INVALID_LENGTH");
  assert.equal(validateProposedSubject("איקס", []).code, "BLOCKED_CONTENT");
  assert.equal(validateProposedSubject("תחום", []).code, "BLOCKED_CONTENT");
});
