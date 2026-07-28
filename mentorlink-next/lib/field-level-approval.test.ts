import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration013 = read("supabase/migrations/202607270013_create_field_level_mentor_review.sql");
const migration014 = read("supabase/migrations/202607280014_allow_city_phone_pending_review.sql");
const migration = migration013 + "\n" + migration014;
const profileApi = read("app/api/mentor-profile/route.ts");
const photoApi = read("app/api/mentor-profile/photo/route.ts");
const adminAction = read("app/api/admin/mentors/[userId]/fields/[changeId]/route.ts");
const adminUi = read("app/dashboard/admin/mentors/_components/AdminMentorsClient.tsx");
const profileUi = read("app/dashboard/mentor/profile/page.tsx");
const publicLoader = read("lib/public-mentor-data.ts");

test("critical public fields are staged while safe structured fields save immediately", () => {
  assert.match(profileApi, /const CRITICAL_FIELDS = \[[^\]]*"city"[^\]]*"phone"[^\]]*\] as const;/);
  assert.match(profileApi, /const SAFE_FIELDS = \["grade", "school", "languages"\] as const;/);

  for (const field of ["first_name", "last_name", "bio", "birth_date", "city", "phone", "profile_photo_path"]) {
    assert.match(migration, new RegExp(field));
  }

  assert.match(migration, /custom_subject:/);
  assert.match(profileApi, /publication\.data\?\.status === "published"/);
  assert.match(profileApi, /mentor_public_pending_changes/);
  assert.match(profileApi, /\.update\(\{ requested_value: normalized\[field\], requested_at: requestedAt \}\)/);
  assert.doesNotMatch(profileApi, /\.update\(\{ current_value:/);
  assert.doesNotMatch(profileApi, /mentor_publication"\)\.update/);
});

test("database triggers preserve approved values and publication status", () => {
  assert.match(migration, /before update on public\.mentor_profiles/);
  assert.match(migration, /new := jsonb_populate_record\(new/);
  assert.match(migration, /new\.custom_subject := previous_value/);
  assert.doesNotMatch(migration, /update public\.mentor_publication\s+set status/i);
  assert.match(publicLoader, /\.eq\("status", "published"\)/);
  assert.doesNotMatch(publicLoader, /mentor_public_pending_changes/);
});

test("mentor labels only affected fields and photo changes use protected review", () => {
  assert.match(profileUi, /pendingFields\.includes\("first_name"\)/);
  assert.match(profileUi, /pendingFields\.includes\("bio"\)/);
  assert.match(profileUi, /השינוי ממתין לאישור/);
  assert.match(photoApi, /publication\.data\?\.status === "published"/);
  assert.match(photoApi, /profile_photo_path/);
  assert.match(photoApi, /pending: true/);
});

test("administrator reviews one field with old versus new and conditional status", () => {
  assert.match(adminUi, /הערך המאושר כעת/);
  assert.match(adminUi, /הערך החדש שהתבקש/);
  assert.match(adminUi, /הבקשה נשלחה/);
  assert.match(adminUi, /אישור השינוי/);
  assert.match(adminUi, /דחיית השינוי/);
  assert.match(adminAction, /new Set\(\[[^\]]*"city"[^\]]*"phone"/);
  assert.match(adminAction, /authorizeAdministrator/);
  assert.match(adminAction, /\.eq\("status", "pending"\)/);
  assert.match(adminAction, /customSubjectId/);
  assert.match(adminAction, /revalidatePath\("\/"\)/);
});

test("migration is narrow, RLS-enabled and grants no anon access", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.mentor_public_pending_changes from anon, authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.match(migration, /grant update \(first_name, last_name, birth_date/);
});