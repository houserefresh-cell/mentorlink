import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("published mentor details exposes a guided meeting action without private fields", () => {
  const directory = read("app/_components/PublicMentorDirectory.tsx");
  const flow = read("app/_components/MeetingRequestFlow.tsx");
  assert.match(directory, /MeetingRequestFlow/);
  assert.match(flow, /בקשת פגישה/);
  assert.match(flow, /config\.mentor\.subjects/);
  assert.match(flow, /availableModes/);
  assert.match(flow, /available-slots/);
  assert.match(flow, /childFirstName/);
  assert.match(flow, /childGradeOrAge/);
  assert.doesNotMatch(
    flow,
    /child.*surname|birth_date|school|medical|parent.*email|mentor.*phone/i,
  );
});

test("guest flow offers login and parent registration with preserved intent", () => {
  const flow = read("app/_components/MeetingRequestFlow.tsx");
  assert.match(flow, /\/login\?returnTo=/);
  assert.match(flow, /\/register\/parent\?returnTo=/);
  assert.match(flow, /action=meeting/);
});

test("mentor availability editor is selection-based and supports all required controls", () => {
  const editor = read("app/dashboard/mentor/scheduling/page.tsx");
  assert.match(editor, /type="time"/);
  assert.match(editor, /type="date"/);
  assert.match(editor, /DURATIONS/);
  assert.match(editor, /meetingMode/);
  assert.match(editor, /עריכה/);
  assert.match(editor, /השבתה/);
  assert.match(editor, /מחיקה/);
  assert.match(editor, /effectiveStartDate/);
});

test("parent and mentor dashboards render request history and valid actions", () => {
  const panel = read("app/dashboard/_components/MeetingRequestsPanel.tsx");
  assert.match(panel, /role: "parent" \| "mentor"/);
  assert.match(panel, /"accept"/);
  assert.match(panel, /"decline"/);
  assert.match(panel, /"propose_alternative"/);
  assert.match(panel, /"cancel"/);
  assert.match(panel, /בחירת מועד חלופי/);
  assert.match(panel, /disabled=\{busyId === item\.id/);
  assert.doesNotMatch(panel, /parent_email|parent_phone|mentor_email|mentor_phone/);
});
test("every disabled meeting state has visible Hebrew guidance matching the API contract", () => {
  const flow = read("app/_components/MeetingRequestFlow.tsx");
  for (const message of [
    "יש לבחור מקצוע.", "יש לבחור אופן פגישה.", "יש לבחור מועד לפגישה.",
    "יש לבחור משך פגישה.", "יש להזין שם פרטי של הילד/ה.",
    "יש לבחור כיתה או גיל.", "בחמישה תווים לפחות.",
  ]) assert.match(flow, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(flow, /missingRequirements\.length === 0/);
  assert.match(flow, /disabled=\{!complete \|\| busy \|\| submitted\}/);
  assert.match(flow, /if \(busy \|\| submitted \|\| !accessToken/);
  assert.match(flow, /parentMessage: message/);
});

test("availability guidance distinguishes no slots from no selected slot", () => {
  const flow = read("app/_components/MeetingRequestFlow.tsx");
  assert.match(flow, /החונך עדיין לא הגדיר מועדים זמינים לפגישה\./);
  assert.match(flow, /hasSelectableSlots && !slot && mode/);
  assert.match(flow, /יש לבחור מועד לפגישה\./);
  assert.match(flow, /aria-live="polite"/);
});
test("parent alternative proposal is actionable and active requests are grouped first", () => {
  const panel = read("app/dashboard/_components/MeetingRequestsPanel.tsx");
  const parentDashboard = read("app/dashboard/parent/requests/page.tsx");
  assert.match(panel, /id="parent-action-title"/);
  assert.match(panel, /id="meeting-requests-title"/);
  assert.match(panel, /act\(item\.id, "accept_alternative"/);
  assert.match(panel, /act\(item\.id, "decline_alternative"/);
  assert.match(panel, /item\.status === "alternative_proposed"/);
  assert.match(panel, /confirmed_start_at/);
  assert.match(panel, /groups\.actionRequired/);
  assert.match(panel, /groups\.waitingForMentor/);
  assert.match(panel, /groups\.upcoming/);
  assert.match(panel, /groups\.completed/);
  assert.match(panel, /groups\.closed/);
  assert.match(panel, /groups\.history/);
  assert.ok(parentDashboard.indexOf("<MeetingRequestsPanel") < parentDashboard.indexOf("<MentorInquiriesPanel"));
});