import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const directory = read("app/_components/PublicMentorDirectory.tsx");
const inquiryFlow = read("app/_components/MentorInquiryFlow.tsx");
const inquiryApi = read("app/api/mentor-inquiries/route.ts");

test("all three independent actions render directly on each mentor card", () => {
  const card = directory.slice(directory.indexOf("function MentorCard"), directory.indexOf("function MentorDetailsDialog"));
  assert.match(card, /onOpen\(mentor, "meeting", event\.currentTarget\)/);
  assert.match(card, /onOpen\(mentor, "inquiry", event\.currentTarget\)/);
  assert.match(card, /onOpen\(mentor, "details", event\.currentTarget\)/);
  assert.match(card, /בקשת פגישה/);
  assert.match(card, /פנייה לחונך/);
  assert.match(card, /לפרטים/);
});

test("details dialog contains no inquiry or meeting form", () => {
  const details = directory.slice(directory.indexOf("function MentorDetailsDialog"), directory.indexOf("function Avatar"));
  assert.doesNotMatch(details, /MentorInquiryFlow|MeetingRequestFlow|role="dialog"/);
  assert.equal((details.match(/<dialog/g) ?? []).length, 1);
});

test("one directory action state permits only one top-level modal", () => {
  assert.match(directory, /type DirectoryAction="details"\|"activities"\|"inquiry"\|"meeting"/);
  assert.match(directory, /activeInteraction\?\.action\s*===\s*"details"/);
  assert.match(directory, /activeInteraction\?\.action\s*===\s*"activities"/);
  assert.match(directory, /activeInteraction\?\.action\s*===\s*"inquiry"/);
  assert.match(directory, /activeInteraction\?\.action\s*===\s*"meeting"/);
  assert.match(directory, /setActiveInteraction\(\{ mentor, action \}\)/);
  assert.match(directory, /setActiveInteraction\(null\)/);
});

test("closing restores focus to the exact originating card action", () => {
  assert.match(directory, /originRef\.current = origin/);
  assert.match(directory, /originRef\.current\?\.focus\(\)/);
  assert.match(directory, /event\.currentTarget/);
});

test("return intent resumes inquiry or meeting without opening details", () => {
  assert.match(directory, /params\.get\("action"\)/);
  assert.match(directory, /action !== "inquiry" && action !== "meeting"/);
  assert.match(directory, /candidate\.bookingId === params\.get\("mentor"\)/);
  assert.match(inquiryFlow, /encodeURIComponent\(`\/\?mentor=\$\{mentorBookingId\}&action=inquiry`\)/);
  assert.match(read("app/_components/MeetingRequestFlow.tsx"), /encodeURIComponent\(`\/\?mentor=\$\{mentorBookingId\}&action=meeting`\)/);
});

test("inquiry required message exactly matches server validation", () => {
  assert.match(inquiryFlow, /trimmedMessageLength >= 5 && trimmedMessageLength <= 1000/);
  assert.match(inquiryFlow, /disabled=\{busy \|\| !messageIsValid\}/);
  assert.match(inquiryFlow, /minLength=\{5\}/);
  assert.match(inquiryFlow, /maxLength=\{1000\}/);
  assert.match(inquiryFlow, /יש לכתוב לפחות 5 תווים/);
  assert.match(inquiryApi, /message\.length < 5/);
});

test("optional subject and grade never block a valid inquiry", () => {
  assert.match(inquiryFlow, /subject: subject \|\| null/);
  assert.match(inquiryFlow, /childGradeOrAge: grade \|\| null/);
  assert.doesNotMatch(inquiryFlow.match(/const messageIsValid[\s\S]*?;/)?.[0] ?? "", /subject|grade/);
});

test("whitespace-only input stays invalid and valid parent submissions are duplicate-safe", () => {
  assert.match(inquiryFlow, /message\.trim\(\)\.length/);
  assert.match(inquiryFlow, /if \(busy \|\| !token/);
  assert.match(inquiryFlow, /setBusy\(true\)/);
  assert.match(inquiryFlow, /disabled=\{busy/);
  assert.match(inquiryFlow, /message: trimmedMessage/);
});

test("session role detection and success feedback remain intact", () => {
  assert.match(inquiryFlow, /supabase\.auth\.getSession\(\)/);
  assert.match(inquiryFlow, /user\.user_metadata\?\.role/);
  assert.match(inquiryFlow, /role !== "parent"/);
  assert.match(inquiryFlow, /הפנייה נשלחה לחונך\./);
  assert.match(inquiryFlow, /\/login\?returnTo=/);
  assert.match(inquiryFlow, /\/register\/parent\?returnTo=/);
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
});
test("parent inquiry cards reuse the public mentor summary and stable opaque deep link", () => {
  const panel = read("app/dashboard/_components/MentorInquiriesPanel.tsx");
  assert.match(inquiryApi, /loadPublishedMentors\(client\)/);
  assert.match(inquiryApi, /public_booking_id/);
  assert.match(inquiryApi, /mentor: mentorSummaries\.get\(mentor_user_id\)/);
  assert.match(panel, /item\.mentor\?\.displayName/);
  assert.match(panel, /item\.mentor\?\.city/);
  assert.match(panel, /item\.mentor\.subjects\.map/);
  assert.match(panel, /mentor=\$\{encodeURIComponent\(item\.mentor\.bookingId\)\}&action=details/);
  assert.match(directory, /action !== "details" && action !== "inquiry" && action !== "meeting"/);
  assert.doesNotMatch(panel, /mentor_user_id|user_id|birth_date|phone|email/i);
});

test("contact details remain hidden because current consent does not authorize sharing", () => {
  const panel = read("app/dashboard/_components/MentorInquiriesPanel.tsx");
  assert.match(panel, /פרטי הקשר יופיעו לאחר שהחונך ישיב לפנייה/);
  assert.match(panel, /לאחר שתוגדר הרשאה מפורשת לשיתוף שלהם/);
  assert.doesNotMatch(panel, /tel:|wa\.me|mentor_phone|mentor_email/i);
  const historyApi = inquiryApi.slice(inquiryApi.indexOf("export async function GET"));
  assert.doesNotMatch(historyApi, /parent_phone|parent_email|profile\.phone|auth\.admin\.getUserById/);
});
