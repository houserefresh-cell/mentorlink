import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const mentorRegister = readFileSync(new URL("../app/register/mentor/page.tsx", import.meta.url), "utf8");
const parentRegister = readFileSync(new URL("../app/register/parent/page.tsx", import.meta.url), "utf8");
const support = readFileSync(new URL("../app/_components/RegistrationSupport.tsx", import.meta.url), "utf8");

test("registration surfaces force readable light form controls", () => {
  assert.match(globals, /color-scheme:\s*light/);
  assert.match(globals, /\.registration-surface input::placeholder/);
  assert.match(globals, /-webkit-text-fill-color:\s*#475569/);
  assert.doesNotMatch(globals, /prefers-color-scheme:\s*dark/);
  assert.match(mentorRegister, /registration-surface/);
  assert.match(parentRegister, /registration-surface/);
});

test("mentor registration offers manager phone and WhatsApp help", () => {
  assert.match(support, /052-224-5128/);
  assert.match(support, /tel:\$\{SUPPORT_PHONE\}/);
  assert.match(support, /wa\.me\/\$\{WHATSAPP_PHONE\}/);
  assert.match(support, /מנהל המערכת/);
  assert.doesNotMatch(support, /גדי/);
});
