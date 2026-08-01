import assert from "node:assert/strict";
import test from "node:test";
import { classifyMentorRegistration, MIN_MENTOR_REGISTRATION_AGE } from "./mentor-registration.ts";

const oldEnoughMinorBirthDate = `${new Date().getUTCFullYear() - 12}-01-01`;
const tooYoungBirthDate = `${new Date().getUTCFullYear() - 8}-01-01`;

test("minimum mentor age is ten", () => assert.equal(MIN_MENTOR_REGISTRATION_AGE, 10));
test("under-age registration is blocked before all other stages", () => assert.equal(classifyMentorRegistration({ birthDate: tooYoungBirthDate, emailConfirmed: true, profileComplete: true, parentConsentStatus: "approved", publicationStatus: "published" }), "blocked_age"));
test("unconfirmed email is visible as awaiting verification", () => assert.equal(classifyMentorRegistration({ birthDate: null, emailConfirmed: false, profileComplete: false, parentConsentStatus: null, publicationStatus: null }), "awaiting_email"));
test("eligible minor waits for parent consent", () => assert.equal(classifyMentorRegistration({ birthDate: oldEnoughMinorBirthDate, emailConfirmed: true, profileComplete: true, parentConsentStatus: "sent", publicationStatus: null }), "awaiting_parent_consent"));
test("submitted mentor moves to the administrator review queue", () => assert.equal(classifyMentorRegistration({ birthDate: oldEnoughMinorBirthDate, emailConfirmed: true, profileComplete: true, parentConsentStatus: "approved", publicationStatus: "pending_review" }), "pending_review"));
