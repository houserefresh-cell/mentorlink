import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const onboarding = read("app/dashboard/mentor/onboarding/page.tsx");
const childrenApi = read("app/api/parent/children/route.ts");
const childManager = read("app/dashboard/parent/preferences/ParentChildrenManager.tsx");
const activityDiscovery = read("app/dashboard/parent/_components/ParentActivityDiscovery.tsx");
const meetings = read("app/dashboard/_components/MeetingRequestsPanel.tsx");
const meetingApi = read("app/api/meeting-requests/route.ts");
const meetingMutationApi = read("app/api/meeting-requests/[requestId]/route.ts");
const parentShell = read("app/dashboard/parent/_components/ParentDashboardShell.tsx");
const meetingFlow = read("app/_components/MeetingRequestFlow.tsx");
const activityForm = read("app/dashboard/mentor/activities/_components/MentorActivityForm.tsx");
const authRouting = read("lib/auth-routing.ts");
const notificationApi = read("app/api/notifications/route.ts");
const migration = read("supabase/migrations/202608180042_child_gender_colors_and_auto_review.sql");
const meetingAttentionMigration = read("supabase/migrations/202608190043_meeting_attention_and_cancellation.sql");

test("mentor onboarding keeps only the approved essentials required and submits automatically", () => {
  assert.match(onboarding, /בחרו לפחות תחום אחד/);
  assert.match(onboarding, /מה חשוב לי בקשר עם החניך/);
  assert.match(onboarding, /מדוע אני רוצה להיות חונך/);
  assert.match(onboarding, /סוגי חונכות[\s\S]*אפשר לבחור יותר מתשובה אחת/);
  assert.match(onboarding, /זמינות · לא חובה/);
  assert.match(onboarding, /בתי ספר ואזור פעילות · לא חובה/);
  assert.match(onboarding, /תמונת פרופיל · לא חובה/);
  assert.match(onboarding, /void submitForReview\(\)/);
  assert.doesNotMatch(onboarding, /שליחת הפרופיל לבדיקת מנהל/);
});

test("activity registration prevents grade mismatches and clearly marks existing registrations", () => {
  assert.match(activityDiscovery, /childGradeAllowed\(child, registering\)/);
  assert.match(activityDiscovery, /לא מתאים לכיתה/);
  assert.match(activityDiscovery, /✓ כבר רשום\/ה/);
  assert.match(activityDiscovery, /✓ כבר ברשימת ההמתנה/);
});

test("children have a required gender and a stable stored display color", () => {
  assert.match(childrenApi, /payload\.gender === "boy" \|\| payload\.gender === "girl"/);
  assert.match(childrenApi, /display_color/);
  assert.match(childManager, /label="בן או בת" required/);
  assert.match(childManager, /display_color/);
  assert.match(migration, /add column if not exists gender text/);
  assert.match(migration, /add column if not exists display_color text/);
  assert.match(migration, /alter column display_color set not null/);
});

test("parent meeting area has child filters, four clear views and notification badges", () => {
  assert.match(meetings, /הפגישות שלי/);
  assert.match(meetings, /פגישות קרובות/);
  assert.match(meetings, /פגישות שממתינות לאישור החונך/);
  assert.match(meetings, /פגישות שהסתיימו/);
  assert.match(meetings, /פגישות שבוטלו/);
  assert.match(meetings, /selectedChildren/);
  assert.match(meetings, /child_display_color/);
  assert.match(meetingApi, /meeting_details_updated/);
  assert.match(meetingApi, /meeting_request_cancelled/);
  assert.match(meetingMutationApi, /kind = "meeting_request_cancelled"/);
  assert.match(meetings, /פחות מ־12 שעות נותרו לפגישה/);
  assert.match(meetings, /markMeetingRead/);
  assert.match(notificationApi, /meetingRequestId/);
  assert.match(notificationApi, /meeting_request_created/);
  assert.match(meetingAttentionMigration, /cancellation_reason/);
});

test("activity and meeting creation use the approved shortcuts", () => {
  assert.match(meetingFlow, /durations\.length === 1/);
  assert.match(meetingFlow, /chooseSlot/);
  assert.match(activityForm, /תמונה טובה מבליטה את הפעילות/);
  assert.match(activityForm, /\/image/);
});

test("ordinary sign in can securely resolve the configured administrator dashboard", () => {
  assert.match(authRouting, /\/api\/account\/dashboard-role/);
  assert.match(authRouting, /\/dashboard\/admin\/mentors/);
});

test("parent navigation separates meetings and mentor inquiries in the requested order", () => {
  const home = parentShell.indexOf('label: "עמוד הבית"');
  const activities = parentShell.indexOf('label: "הפעילויות שלי"');
  const meetingsIndex = parentShell.indexOf('label: "הפגישות שלי"');
  const inquiries = parentShell.indexOf('label: "פניות לחונך"');
  const feedback = parentShell.indexOf('label: "משובים להשלמה"');
  assert.ok(home < activities && activities < meetingsIndex && meetingsIndex < inquiries && inquiries < feedback);
});

test("parent consent approval can automatically submit a complete minor mentor profile", () => {
  assert.match(migration, /submit_minor_mentor_after_parent_consent/);
  assert.match(migration, /new\.status = 'approved'/);
  assert.match(migration, /insert into public\.mentor_publication/);
  assert.match(migration, /pending_review/);
});
