import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const createRoute = read("app/api/mentor-inquiries/route.ts");
const actionRoute = read("app/api/mentor-inquiries/[inquiryId]/route.ts");
const migration = read("supabase/migrations/202607270012_create_mentor_inquiries_web_push.sql");

test("general inquiry creation authenticates a parent and targets only a published mentor", () => {
  assert.ok(createRoute.indexOf("authenticateMeetingUser") < createRoute.indexOf("createSupabaseAdmin"));
  assert.match(createRoute, /user\.role !== "parent"/);
  assert.match(createRoute, /loadPublishedSchedulingMentor/);
  assert.match(createRoute, /mentor\.subjects\.includes\(subject\)/);
  assert.match(createRoute, /idempotency_key/);
  assert.match(createRoute, /23505/);
});

test("inquiry history and actions stay owner-scoped", () => {
  assert.match(createRoute, /user\.role === "parent" \? "parent_user_id" : "mentor_user_id"/);
  assert.match(createRoute, /\.eq\(ownerColumn, user\.id\)/);
  assert.match(actionRoute, /row\.parent_user_id === user\.id/);
  assert.match(actionRoute, /row\.mentor_user_id === user\.id/);
  assert.match(actionRoute, /\.eq\("status", row\.status\)/);
  assert.match(actionRoute, /action === "respond" && isMentor/);
  assert.match(actionRoute, /action === "close" && isMentor/);
  assert.match(actionRoute, /action === "cancel" && isParent/);
});

test("inquiry responses expose no private contact or internal mentor identifier", () => {
  assert.match(createRoute, /\(\{ mentor_user_id, \.\.\.row \}\)/);
  assert.doesNotMatch(createRoute, /parent_email|parent_phone|mentor_email|mentor_phone/i);
  assert.doesNotMatch(actionRoute, /parent_email|parent_phone|mentor_email|mentor_phone/i);
});

test("general inquiries remain separate from meeting requests", () => {
  assert.match(migration, /create table public\.mentor_inquiries/);
  assert.doesNotMatch(createRoute, /from\("meeting_requests"\)/);
  assert.doesNotMatch(actionRoute, /from\("meeting_requests"\)/);
  assert.match(createRoute, /from\("mentor_inquiries"\)/);
  assert.match(actionRoute, /from\("mentor_inquiries"\)/);
});

test("migration uses narrow ownership RLS and grants", () => {
  assert.match(migration, /alter table public\.mentor_inquiries enable row level security/);
  assert.match(migration, /parent_user_id = auth\.uid\(\) or mentor_user_id = auth\.uid\(\)/);
  assert.match(migration, /alter table public\.push_subscriptions enable row level security/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration, /grant all|grant .* to anon/i);
  assert.match(migration, /unique \(parent_user_id, idempotency_key\)/);
  assert.match(migration, /constraint push_subscriptions_endpoint_unique unique \(endpoint\)/);
});

test("saved inquiry actions happen before fallback delivery", () => {
  assert.ok(createRoute.indexOf('from("mentor_inquiries").insert') < createRoute.lastIndexOf("deliverInquiryUpdate"));
  assert.ok(actionRoute.indexOf('from("mentor_inquiries").update') < actionRoute.lastIndexOf("deliverInquiryUpdate"));
});