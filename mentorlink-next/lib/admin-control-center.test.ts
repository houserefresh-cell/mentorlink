import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { classifyAdminAttention, filterActivityRows, filterMeetingRows, summarizeAdminKpis } from "./admin-control-center-core.ts";

const apiPath = "app/api/admin/control-center/route.ts";
const pagePath = "app/dashboard/admin/page.tsx";
const layout = fs.readFileSync("app/dashboard/admin/layout.tsx", "utf8");
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, "utf8") : "";
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";

test("admin landing page is linked from the admin navigation shell", () => {
  assert.match(layout, /dashboard\/admin\"/);
  assert.match(layout, />לוח בקרה</);
  assert.match(layout, /dashboard\/admin\/mentors/);
});

test("control center API authorizes the administrator before reading operational tables", () => {
  assert.ok(api.length > 0, "control center API route should exist");
  assert.ok(page.length > 0, "control center page should exist");
  assert.ok(api.indexOf("authorizeAdministrator") >= 0, "control center API must authorize before opening the service-role client");
  assert.match(api, /mentor_publication/);
  assert.match(api, /mentor_activities/);
  assert.match(api, /meeting_requests/);
});

test("summary KPI calculation counts the expected admin states", () => {
  const summary = summarizeAdminKpis({
    publicationRows: [{ status: "published" }, { status: "pending_review" }, { status: "paused" }],
    activityRows: [{ status: "published" }, { status: "draft" }],
    meetingRows: [{ status: "pending" }, { status: "accepted" }, { status: "cancelled" }],
    activityFeedbackRows: [{ admin_handling_status: "new" }, { admin_handling_status: "resolved" }],
    meetingFeedbackRows: [{ admin_handling_status: "reviewing" }],
    controlRows: [{ status: "suspended" }, { status: "blocked" }],
  });

  assert.equal(summary.publishedMentors, 1);
  assert.equal(summary.pendingMentors, 1);
  assert.equal(summary.publishedActivities, 1);
  assert.equal(summary.pendingMeetings, 1);
  assert.equal(summary.acceptedMeetings, 1);
  assert.equal(summary.unresolvedFeedback, 2);
  assert.equal(summary.suspendedAccounts, 1);
  assert.equal(summary.blockedAccounts, 1);
});

test("filter helpers support admin search and status filter logic", () => {
  const meetings = [
    { id: "a", status: "pending", subject: "מתמטיקה", mentor_user_id: "mentor-1", mentor_name: "אבי", parent_name: "מור", child_first_name: "יונתן", requested_start_at: "2026-09-10T10:00:00Z" },
    { id: "b", status: "accepted", subject: "אנגלית", mentor_user_id: "mentor-2", mentor_name: "שירה", parent_name: "גלעד", child_first_name: "נועה", requested_start_at: "2026-09-12T10:00:00Z" },
  ];
  const activities = [
    { id: "act-1", status: "published", title: "מועדון קריאה", mentor_user_id: "mentor-1", mentor_name: "אבי", created_at: "2026-09-01T12:00:00Z" },
    { id: "act-2", status: "draft", title: "תכנות", mentor_user_id: "mentor-3", mentor_name: "טל", created_at: "2026-09-02T12:00:00Z" },
  ];

  assert.equal(filterMeetingRows(meetings, { status: "pending" }).length, 1);
  assert.equal(filterMeetingRows(meetings, { search: "נועה" }).length, 1);
  assert.equal(filterActivityRows(activities, { search: "קריאה" }).length, 1);
});

test("attention classification flags deterministic admin issues", () => {
  const items = classifyAdminAttention({
    meetings: [
      { id: "m1", status: "pending", subject: "מתמטיקה", requested_start_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T12:00:00Z" },
      { id: "m2", status: "cancelled", subject: "אנגלית", cancelled_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    ],
    activities: [{ id: "a1", title: "טיפוח", status: "published", max_participants: 10, registration_count: 10, updated_at: new Date().toISOString() }],
    feedback: [{ id: "f1", admin_handling_status: "new", safety_incident: true, requests_admin_contact: false, submitted_at: new Date().toISOString() }],
  });

  assert.ok(items.some((item) => item.entityType === "meeting" && item.severity === "warning"));
  assert.ok(items.some((item) => item.entityType === "activity" && item.severity === "critical"));
  assert.ok(items.some((item) => item.entityType === "feedback" && item.severity === "critical"));
});
