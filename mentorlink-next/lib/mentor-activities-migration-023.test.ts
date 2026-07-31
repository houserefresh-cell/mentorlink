import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607310023_add_activity_accessibility.sql",
    import.meta.url,
  ),
  "utf8",
);

test("migration 023 adds structured accessibility without editing migration 022", () => {
  assert.match(migration, /alter table public\.mentor_activities/);
  assert.match(migration, /accessibility_options text\[\] not null default '\{\}'::text\[\]/);
  assert.match(migration, /accessibility_other text/);
  for (const option of [
    "wheelchair", "accessible_restrooms", "accessible_parking",
    "visual_impairment", "hearing_impairment", "written_visual_instructions",
    "sensory_friendly", "companion_allowed", "other", "unknown",
  ]) assert.match(migration, new RegExp(`'${option}'`));
});

test("accessibility constraints keep unknown and other details consistent", () => {
  assert.match(migration, /mentor_activities_accessibility_unknown_valid/);
  assert.match(migration, /cardinality\(accessibility_options\) = 1/);
  assert.match(migration, /mentor_activities_accessibility_other_valid/);
  assert.match(migration, /'other' = any\(accessibility_options\)/);
  assert.match(migration, /char_length\(btrim\(accessibility_other\)\) between 1 and 1000/);
});

test("normalization runs transactionally and is not executable by clients", () => {
  assert.match(migration, /before insert or update of accessibility/);
  assert.match(migration, /new\.accessibility_options :=/);
  assert.match(migration, /new\.accessibility_other :=/);
  assert.match(migration, /revoke all on function public\.normalize_mentor_activity_accessibility\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.normalize_mentor_activity_accessibility\(\) to service_role/);
});
