import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const onboarding = readFileSync(
  new URL("../app/dashboard/mentor/onboarding/page.tsx", import.meta.url),
  "utf8",
);
const shell = readFileSync(
  new URL("../app/dashboard/mentor/_components/MentorPageShell.tsx", import.meta.url),
  "utf8",
);

test("minor mentor onboarding makes parent consent an explicit required action", () => {
  assert.match(onboarding, /שלב חובה לחונך קטין/);
  assert.match(onboarding, /href="\/dashboard\/mentor\/parent-consent"/);
  assert.match(onboarding, /מילוי פרטי ההורה ושליחת בקשה/);
  assert.match(onboarding, /אישור ההורה התקבל/);
});

test("review submission stays disabled until every registration requirement is complete", () => {
  assert.match(onboarding, /const readyForReview = profileDetailsComplete && emailConfirmed && parentConsentComplete/);
  assert.match(onboarding, /disabled=\{!readyForReview\}/);
  assert.match(shell, /disabled=\{saving \|\| disabled\}/);
});

test("optional notifications follow the required registration controls", () => {
  const submit = onboarding.indexOf("שליחת הפרופיל לבדיקת מנהל");
  const optional = onboarding.indexOf("אופציונלי — לא נדרש להשלמת ההרשמה");
  assert.ok(submit >= 0 && optional > submit);
});

test("registration progress includes email and parent consent requirements", () => {
  assert.match(onboarding, /requirements = \[\.\.\.requiredProfileChecks, emailConfirmed\]/);
  assert.match(onboarding, /if \(isMinor === true\) requirements\.push\(consentStatus === "approved"\)/);
  assert.match(onboarding, /כל הדרישות הושלמו/);
});
