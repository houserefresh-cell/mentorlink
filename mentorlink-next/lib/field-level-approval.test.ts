import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration013 = read("supabase/migrations/202607270013_create_field_level_mentor_review.sql");
const migration014 = read("supabase/migrations/202607280014_allow_city_phone_pending_review.sql");
const migration015 = read("supabase/migrations/202607280015_allow_pending_change_cancellation.sql");
const migration016 = read("supabase/migrations/202607290016_review_pending_profile_changes_atomically.sql");
const profileApi = read("app/api/mentor-profile/route.ts");
const photoApi = read("app/api/mentor-profile/photo/route.ts");
const adminAction = read("app/api/admin/mentors/[userId]/fields/[changeId]/route.ts");
const profileUi = read("app/dashboard/mentor/profile/page.tsx");
const publicLoader = read("lib/public-mentor-data.ts");

const stagingMigrations = `${migration013}\n${migration014}`;
const migration016Trigger = migration016.slice(0, migration016.indexOf("create or replace function public.review_mentor_public_pending_change"));

test("critical public fields are staged while safe structured fields save immediately", () => {
  assert.match(profileApi, /const CRITICAL_FIELDS = \[[^\]]*"city"[^\]]*"phone"[^\]]*\] as const;/);
  assert.match(profileApi, /const SAFE_FIELDS = \["grade", "school", "languages"\] as const;/);
  for (const field of ["first_name", "last_name", "bio", "birth_date", "city", "phone", "profile_photo_path"]) {
    assert.match(stagingMigrations, new RegExp(field));
  }
  assert.match(profileApi, /publication\.data\?\.status === "published"/);
  assert.doesNotMatch(profileApi, /mentor_publication"\)\.update/);
});

test("approved public values remain unchanged while a field is pending", () => {
  assert.match(stagingMigrations, /before update on public\.mentor_profiles/);
  assert.match(stagingMigrations, /new := jsonb_populate_record\(new/);
  assert.match(stagingMigrations, /new\.custom_subject := previous_value/);
  assert.doesNotMatch(stagingMigrations, /update public\.mentor_publication\s+set status/i);
  assert.match(publicLoader, /\.eq\("status", "published"\)/);
  assert.doesNotMatch(publicLoader, /mentor_public_pending_changes/);
});

test("mentor pending UI supports all profile fields and cancellation remains owner-scoped", () => {
  for (const field of ["first_name", "last_name", "birth_date", "bio", "city", "phone"]) {
    assert.match(profileUi, new RegExp(`pendingFields\\.includes\\("${field}"\\)`));
  }
  assert.match(profileUi, /cancelPendingChange/);
  assert.match(profileApi, /\.eq\("mentor_user_id", user\.id\)/);
  assert.match(profileApi, /export async function DELETE/);
  assert.match(migration015, /grant delete[\s\S]*to service_role/i);
  assert.doesNotMatch(migration015, /to (anon|authenticated)/i);
  assert.match(photoApi, /profile_photo_path/);
});

test("administrator approval uses one atomic database review operation", () => {
  assert.match(adminAction, /authorizeAdministrator/);
  assert.match(adminAction, /createSupabaseAdmin/);
  assert.match(adminAction, /\.rpc\("review_mentor_public_pending_change"/);
  assert.doesNotMatch(adminAction, /from\("mentor_profiles"\)\.update/);

  assert.match(migration016, /for update;/i);
  assert.match(migration016, /set_config\('mentorlink\.field_review', 'on', true\)/);
  assert.match(migration016, /current_setting\('mentorlink\.field_review', true\) = 'on'/);
  assert.doesNotMatch(migration016Trigger, /auth\.role\(\)|service_role/);
  assert.match(migration016, /pending_change\.status <> 'pending'/);
  assert.match(migration016, /get diagnostics affected_rows = row_count;/i);
  assert.match(migration016, /update public\.mentor_profiles/);
  assert.match(migration016, /update public\.mentor_public_pending_changes[\s\S]*status = case/i);
  assert.match(migration016, /update auth\.users[\s\S]*raw_user_meta_data/i);
  assert.match(migration016, /return query select 'conflict'/);

  for (const field of ["first_name", "last_name", "birth_date", "bio", "city", "phone", "profile_photo_path"]) {
    assert.match(migration016, new RegExp(`when '${field}'`));
  }
});

test("atomic review RPC and public cache invalidation are narrowly scoped", () => {
  assert.match(migration016, /security definer/);
  assert.match(migration016, /auth\.role\(\)[\s\S]*'service_role'/);
  assert.match(migration016, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration016, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration016, /grant execute[\s\S]*to (anon|authenticated)/);
  assert.match(publicLoader, /tags: \["public-mentors"\]/);
  assert.match(adminAction, /revalidateTag\("public-mentors", \{ expire: 0 \}\)/);
  assert.match(adminAction, /revalidatePath\("\/dashboard\/mentor\/profile"\)/);
  assert.match(adminAction, /revalidatePath\(`\/dashboard\/admin\/mentors\/\$\{userId\}`\)/);
});