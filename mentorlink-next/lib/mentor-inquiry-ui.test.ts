import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("published mentor dialog presents two separate parent actions", () => {
  const directory = read("app/_components/PublicMentorDirectory.tsx");
  assert.match(directory, /MentorInquiryFlow/);
  assert.match(directory, /MeetingRequestFlow/);
  assert.match(directory, /subjects=\{mentor\.subjects\}/);
});

test("inquiry form preserves guest intent and uses controlled optional selections", () => {
  const flow = read("app/_components/MentorInquiryFlow.tsx");
  assert.match(flow, /\/login\?returnTo=/);
  assert.match(flow, /\/register\/parent\?returnTo=/);
  assert.match(flow, /action=inquiry/);
  assert.match(flow, /subjects\.map/);
  assert.match(flow, /GRADES\.map/);
  assert.match(flow, /minLength=\{5\}/);
  assert.match(flow, /maxLength=\{1000\}/);
  assert.doesNotMatch(flow, /surname|birth.?date|school|medical|phone|email/i);
});

test("mentor and parent dashboards keep inquiries in a dedicated area", () => {
  const panel = read("app/dashboard/_components/MentorInquiriesPanel.tsx");
  assert.match(read("app/dashboard/mentor/inquiries/page.tsx"), /MentorInquiriesPanel role="mentor"/);
  assert.match(read("app/dashboard/parent/page.tsx"), /MentorInquiriesPanel role="parent"/);
  assert.match(panel, /"respond"/);
  assert.match(panel, /"close"/);
  assert.match(panel, /"cancel"/);
  assert.doesNotMatch(panel, /meeting_requests|parent_email|parent_phone|mentor_email|mentor_phone/i);
});

test("onboarding is optional and notification controls remain available later", () => {
  const onboarding = read("app/dashboard/mentor/onboarding/page.tsx");
  const dashboard = read("app/dashboard/mentor/page.tsx");
  const controls = read("app/dashboard/_components/WebPushControls.tsx");
  assert.match(onboarding, /WebPushControls compact/);
  assert.match(dashboard, /\/dashboard\/mentor\/notifications/);
  assert.match(controls, /setMessage/);
  assert.match(controls, /setShowInstall/);
  assert.match(controls, /<ol/);
});