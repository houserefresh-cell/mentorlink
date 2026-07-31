import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607310022_create_mentor_activities.sql",
    import.meta.url,
  ),
  "utf8",
);

test("activities use the shared subject catalog without depending on availability or mentor subjects", () => {
  assert.match(migration, /subject_id bigint not null references public\.subjects\(id\) on delete restrict/);
  assert.match(migration, /mentor_user_id uuid not null references auth\.users\(id\) on delete restrict/);
  assert.doesNotMatch(migration, /mentor_subjects|availability|blackout/);
});

test("activity details cover lifecycle, format, location, audience, price and registration rules", () => {
  for (const value of ["draft", "published", "cancelled", "completed"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  assert.match(migration, /format in \('one_time', 'series'\)/);
  const activityDefinition = migration.slice(
    migration.indexOf("create table public.mentor_activities"),
    migration.indexOf("create table public.mentor_activity_sessions"),
  );
  const sessionDefinition = migration.slice(
    migration.indexOf("create table public.mentor_activity_sessions"),
    migration.indexOf("create table public.mentor_activity_registrations"),
  );
  assert.doesNotMatch(activityDefinition, /estimated_overrun/);
  assert.match(sessionDefinition, /estimated_overrun text not null default 'none'/);
  assert.match(sessionDefinition, /estimated_overrun in \('none', '5_10_minutes', '15_20_minutes'\)/);
  for (const value of [
    "mentor_home", "mentee_home", "school", "public_place", "sports_park",
    "community_center", "sports_complex", "online", "other",
  ]) assert.match(migration, new RegExp(`'${value}'`));
  assert.match(migration, /max_participants between 1 and 500 and max_participants >= min_participants/);
  assert.match(migration, /mentor_activities_age_range_valid/);
  assert.match(migration, /mentor_activities_audience_present/);
  assert.match(migration, /mentor_activities_price_valid/);
assert.match(migration, /description is null or char_length\(btrim\(description\)\) between 10 and 4000/);
  assert.match(migration, /registration_deadline timestamptz,/);
  assert.doesNotMatch(migration, /registration_deadline timestamptz not null/);
  assert.match(migration, /pickup_options text\[\] not null default '\{\}'::text\[\]/);
  assert.match(migration, /pickup_options <@ array\['school', 'after_school', 'home', 'other'\]/);
  assert.match(migration, /pickup_details text check/);
  assert.match(migration, /'other' = any\(pickup_options\)/);
  assert.match(migration, /char_length\(btrim\(pickup_details\)\) between 1 and 500/);
  assert.match(migration, /published_at timestamptz/);
  assert.match(migration, /cancelled_at timestamptz/);
  assert.match(migration, /completed_at timestamptz/);
  assert.match(migration, /mentor_activities_status_timestamps_valid/);
});

test("sessions and registrations are separate children deleted only with their activity", () => {
  assert.match(migration, /create table public\.mentor_activity_sessions/);
  assert.match(migration, /create table public\.mentor_activity_registrations/);
  assert.equal(
    (migration.match(/references public\.mentor_activities\(id\) on delete cascade/g) ?? []).length,
    2,
  );
  assert.match(migration, /mentor_activity_sessions_interval_valid check \(ends_at > starts_at\)/);
  assert.match(migration, /status in \('registered', 'waitlisted', 'cancelled'\)/);
  assert.match(migration, /child_first_name text not null/);
  assert.match(migration, /child_grade_or_age text not null/);
  assert.match(migration, /parent_user_id uuid not null references auth\.users\(id\) on delete restrict/);
  assert.match(migration, /idempotency_key uuid not null/);
  assert.match(
    migration,
    /mentor_activity_registration_idempotency_unique unique \(\s*parent_user_id, idempotency_key\s*\)/s,
  );
});

test("all activity tables have timestamps, indexes, RLS and service-role-only writes", () => {
  for (const table of [
    "mentor_activities",
    "mentor_activity_sessions",
    "mentor_activity_registrations",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    assert.match(
      migration,
      new RegExp(`grant select, insert, update, delete\\s+on table public\\.${table}\\s+to service_role`, "s"),
    );
  }
  assert.equal((migration.match(/created_at timestamptz not null default now\(\)/g) ?? []).length, 3);
  assert.equal((migration.match(/updated_at timestamptz not null default now\(\)/g) ?? []).length, 3);
  assert.ok((migration.match(/create index /g) ?? []).length >= 6);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all)[^;]*to (?:anon|authenticated)/is);
});
