alter table public.mentor_activities
  add column accessibility_options text[] not null default '{}'::text[],
  add column accessibility_other text;

alter table public.mentor_activities
  add constraint mentor_activities_accessibility_options_valid check (
    accessibility_options <@ array[
      'wheelchair', 'accessible_restrooms', 'accessible_parking',
      'visual_impairment', 'hearing_impairment', 'written_visual_instructions',
      'sensory_friendly', 'companion_allowed', 'other', 'unknown'
    ]::text[]
  ),
  add constraint mentor_activities_accessibility_unknown_valid check (
    not ('unknown' = any(accessibility_options))
    or cardinality(accessibility_options) = 1
  ),
  add constraint mentor_activities_accessibility_other_valid check (
    (
      'other' <> all(accessibility_options)
      and accessibility_other is null
    )
    or (
      'other' = any(accessibility_options)
      and accessibility_other is not null
      and char_length(btrim(accessibility_other)) between 1 and 1000
    )
  );

create or replace function public.normalize_mentor_activity_accessibility()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
begin
  if new.accessibility is null or left(ltrim(new.accessibility), 1) <> '{' then
    return new;
  end if;

  begin
    payload := new.accessibility::jsonb;
  exception when others then
    return new;
  end;

  new.accessibility_options := coalesce(
    array(select jsonb_array_elements_text(coalesce(payload -> 'options', '[]'::jsonb))),
    '{}'::text[]
  );
  new.accessibility_other := nullif(btrim(payload ->> 'other'), '');
  return new;
end;
$$;

create trigger mentor_activities_normalize_accessibility
before insert or update of accessibility on public.mentor_activities
for each row execute function public.normalize_mentor_activity_accessibility();

revoke all on function public.normalize_mentor_activity_accessibility() from public, anon, authenticated;
grant execute on function public.normalize_mentor_activity_accessibility() to service_role;

comment on column public.mentor_activities.accessibility_options is
  'Structured accessibility choices. An empty array means no choices were supplied.';
comment on column public.mentor_activities.accessibility_other is
  'Free text allowed only when accessibility_options contains other.';
