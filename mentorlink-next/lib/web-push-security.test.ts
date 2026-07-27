import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const controls = read("app/dashboard/_components/WebPushControls.tsx");
const subscriptions = read("app/api/push-subscriptions/route.ts");
const testRoute = read("app/api/push-subscriptions/test/route.ts");
const delivery = read("lib/web-push-delivery.ts");
const worker = read("public/sw.js");

test("notification permission is requested only by explicit activation", () => {
  const enableStart = controls.indexOf("async function enable()");
  const unsubscribeStart = controls.indexOf("async function unsubscribe()");
  const permissionCall = controls.indexOf("Notification.requestPermission()");
  assert.ok(enableStart >= 0 && permissionCall > enableStart && permissionCall < unsubscribeStart);
  assert.match(controls, /onClick=\{enable\}/);
  assert.doesNotMatch(controls.slice(0, enableStart), /requestPermission/);
  assert.match(
    controls,
    /Notification\.permission === "granted"[\s\S]*\? "granted"[\s\S]*Notification\.requestPermission\(\)/,
  );
});

test("Web Push is feature-detected and iOS activation waits for standalone mode", () => {
  assert.match(controls, /"serviceWorker" in navigator/);
  assert.match(controls, /"PushManager" in window/);
  assert.match(controls, /"Notification" in window/);
  assert.match(controls, /display-mode: standalone/);
  assert.match(controls, /isIos && !standalone/);
  assert.match(controls, /disabled=\{busy \|\| !supported \|\| \(isIos && !standalone\)\}/);
});

test("activation validates configuration and reports only safe stage diagnostics", () => {
  assert.match(subscriptions, /parsePublicVapidKey/);
  assert.match(subscriptions, /publicKey: configured && publicKey\.ok \? publicKey\.key : null/);
  for (const code of [
    "SW_REGISTER_FAILED",
    "SW_NOT_READY",
    "VAPID_INVALID",
    "SUBSCRIBE_FAILED",
    "API_POST_FAILED",
  ]) {
    assert.match(controls, new RegExp(code));
  }
  assert.match(controls, /errorName: safeErrorName\(error\)/);
  assert.doesNotMatch(
    controls.slice(0, controls.indexOf("export default function")),
    /endpoint|p256dh|auth_key/i,
  );
});

test("activation reuses an existing iPhone subscription before creating one", () => {
  const enableStart = controls.indexOf("async function enable()");
  const getExisting = controls.indexOf("registration.pushManager.getSubscription()", enableStart);
  const subscribe = controls.indexOf("registration.pushManager.subscribe({", enableStart);
  const post = controls.indexOf('method: "POST"', subscribe);
  assert.ok(getExisting >= 0 && subscribe > getExisting && post > subscribe);
  assert.match(controls.slice(enableStart), /getSubscription\(\)[\s\S]*\?\? await registration\.pushManager\.subscribe/);
});

test("service-worker readiness is bounded and registration requests root scope", () => {
  assert.match(controls, /register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.match(controls, /serviceWorkerReady\(timeoutMilliseconds = 10_000\)/);
  assert.match(controls, /registration\.update\(\)/);
});
test("subscription APIs always authenticate and scope endpoints to the signed-in user", () => {
  for (const source of [subscriptions, testRoute]) assert.match(source, /authenticateMeetingUser/);
  assert.match(subscriptions, /existing\.data\.user_id !== user\.id/);
  assert.match(subscriptions, /\.delete\(\)\.eq\("user_id", user\.id\)\.eq\("endpoint", endpoint\)/);
  assert.match(delivery, /\.eq\("user_id", userId\)\.eq\("endpoint", endpoint\)/);
  assert.match(testRoute, /sendPushToSubscription\(createSupabaseAdmin\(\), user\.id, endpoint/);
});

test("test Push is rate limited and expired subscriptions are removed", () => {
  assert.match(delivery, /Date\.now\(\) - lastTested < 60_000/);
  assert.match(testRoute, /status: 429/);
  assert.equal((delivery.match(/\[404, 410\]\.includes\((?:result|delivery)\.statusCode \?\? 0\)/g) ?? []).length, 2);
  assert.match(delivery, /\.delete\(\).*\.eq\("user_id", userId\)/s);
});

test("Push delivery is generic, best effort and keeps secrets server-only", () => {
  assert.match(delivery, /import "server-only"/);
  assert.match(delivery, /WEB_PUSH_VAPID_PRIVATE_KEY/);
  assert.match(delivery, /catch \(error\)/);
  assert.doesNotMatch(controls, /WEB_PUSH_VAPID_PRIVATE_KEY|p256dh_key|auth_key/);
  assert.doesNotMatch(delivery, /console\.(?:log|error)\([^)]*(?:endpoint|p256dh|auth_key)/s);
  const meetingCreate = read("app/api/meeting-requests/route.ts");
  assert.ok(meetingCreate.indexOf('from("meeting_requests").insert') < meetingCreate.lastIndexOf("sendPushToUser"));
});

test("service worker allows only safe same-origin paths and does not cache", () => {
  assert.match(worker, /startsWith\("\/"\) && !.*startsWith\("\/\/"\)/);
  assert.match(worker, /new URL\(href, self\.location\.origin\)/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.doesNotMatch(worker, /caches\.|addAll|fetch.*addEventListener/s);
});

test("inquiry and meeting Push payloads have distinct generic text", () => {
  const inquiry = read("app/api/mentor-inquiries/route.ts");
  const meeting = read("app/api/meeting-requests/route.ts");
  assert.match(inquiry, /mentor_inquiry_created/);
  assert.match(meeting, /meeting_request_created/);
  assert.match(inquiry, /\/dashboard\/mentor\/inquiries/);
  assert.match(meeting, /\/dashboard\/mentor\/meeting-requests/);
  const inquiryPush = inquiry.slice(inquiry.lastIndexOf("deliverInquiryUpdate"));
  const meetingPush = meeting.slice(meeting.lastIndexOf("sendPushToUser"));
  assert.doesNotMatch(`${inquiryPush}\n${meetingPush}`, /childFirstName|parentMessage|helpGoal|subject:/);
});
test("real inquiry Push is awaited, best effort, and uses the shared delivery primitive", () => {
  const inquiryRoute = read("app/api/mentor-inquiries/route.ts");
  const inquiryDelivery = read("lib/inquiry-notifications.ts");
  assert.match(inquiryRoute, /await deliverInquiryUpdate\(client/);
  assert.match(inquiryRoute, /userId: mentor\.mentorUserId/);
  assert.match(inquiryDelivery, /await sendPushToUser\(client, input\.userId/);
  assert.match(inquiryDelivery, /catch \(error\)/);
  assert.equal((delivery.match(/deliverSubscription\(/g) ?? []).length, 3);
});

test("server diagnostics are sanitized and temporary provider failures retain subscriptions", () => {
  for (const value of ["notificationType", "stage", "subscriptions", "successes", "failures", "providerStatus", "errorName"]) {
    assert.match(delivery, new RegExp(value));
  }
  assert.match(delivery, /if \(\[404, 410\]\.includes/);
  assert.doesNotMatch(delivery, /diagnostic\([^\n]*(?:endpoint|p256dh|auth_key)/);
  assert.doesNotMatch(delivery, /else[\s\S]{0,80}\.delete\(\)/);
});
