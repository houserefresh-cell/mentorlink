create table public.mentor_public_pending_changes (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  field_name text not null check (
    field_name in ('first_name', 'last_name', 'bio', 'birth_date', 'profile_photo_path')
    or field_name ~ '^custom_subject:[0-9]+$'
  ),
  current_value jsonb,
  requested_value jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  constraint mentor_public_pending_changes_review_valid check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and rejection_reason is null)
    or (status = 'approved' and reviewed_at is not null and reviewed_by is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and rejection_reason is not null)
  )
);

create unique index mentor_public_pending_changes_one_pending_field
  on public.mentor_public_pending_changes (mentor_user_id, field_name)
  where status = 'pending';
create index mentor_public_pending_changes_admin_queue
  on public.mentor_public_pending_changes (status, requested_at)
  where status = 'pending';

alter table public.mentor_public_pending_changes enable row level security;
revoke all on public.mentor_public_pending_changes from anon, authenticated;
revoke all on public.mentor_public_pending_changes from service_role;
grant select, insert on public.mentor_public_pending_changes to service_role;
grant update (requested_value, requested_at, status, reviewed_at, reviewed_by, rejection_reason)
  on public.mentor_public_pending_changes to service_role;

create or replace function public.stage_published_mentor_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  publication_status text;
  changed_field text;
  old_value jsonb;
  new_value jsonb;
begin
  if (select auth.role()) = 'service_role' then return new; end if;
  select status into publication_status from public.mentor_publication where user_id = old.user_id;
  if publication_status <> 'published' then return new; end if;
  foreach changed_field in array array['first_name','last_name','bio','birth_date','profile_photo_path'] loop
    old_value := to_jsonb(old) -> changed_field;
    new_value := to_jsonb(new) -> changed_field;
    if old_value is distinct from new_value then
      update public.mentor_public_pending_changes set requested_value = new_value, requested_at = now()
        where mentor_user_id = old.user_id and field_name = changed_field and status = 'pending';
      if not found then
        insert into public.mentor_public_pending_changes (mentor_user_id, field_name, current_value, requested_value)
        values (old.user_id, changed_field, old_value, new_value);
      end if;
      new := jsonb_populate_record(new, jsonb_build_object(changed_field, old_value));
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.stage_published_mentor_profile_changes() from public, anon, authenticated;
create trigger stage_published_mentor_profile_changes
before update on public.mentor_profiles for each row
execute function public.stage_published_mentor_profile_changes();

create or replace function public.stage_published_custom_subject_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  publication_status text;
  pending_field text;
  previous_value text;
  requested_value text;
begin
  if (select auth.role()) = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' and old.custom_subject is not distinct from new.custom_subject then return new; end if;
  select status into publication_status from public.mentor_publication where user_id = new.user_id;
  if publication_status <> 'published' then return new; end if;
  previous_value := case when tg_op = 'UPDATE' then old.custom_subject else null end;
  requested_value := new.custom_subject;
  if requested_value is null then return new; end if;
  pending_field := 'custom_subject:' || new.subject_id::text;
  update public.mentor_public_pending_changes set requested_value = to_jsonb(requested_value), requested_at = now()
    where mentor_user_id = new.user_id and field_name = pending_field and status = 'pending';
  if not found then
    insert into public.mentor_public_pending_changes (mentor_user_id, field_name, current_value, requested_value)
    values (new.user_id, pending_field, to_jsonb(previous_value), to_jsonb(requested_value));
  end if;
  new.custom_subject := previous_value;
  return new;
end;
$$;
revoke all on function public.stage_published_custom_subject_changes() from public, anon, authenticated;
create trigger stage_published_custom_subject_changes
before insert or update of custom_subject on public.mentor_subjects for each row
execute function public.stage_published_custom_subject_changes();
alter table public.mentor_availability_windows
  drop constraint mentor_availability_window_durations_valid,
  add constraint mentor_availability_window_durations_valid check (
    cardinality(supported_durations) > 0
    and supported_durations <@ array[
      15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,
      95,100,105,110,115,120,125,130,135,140,145,150,155,160,165,170,175,180
    ]
  );

alter table public.meeting_requests
  drop constraint if exists meeting_requests_requested_duration_minutes_check,
  add constraint meeting_requests_requested_duration_minutes_check check (
    requested_duration_minutes between 15 and 180
    and requested_duration_minutes % 5 = 0
  ),
  drop constraint if exists meeting_requests_proposed_duration_minutes_check,
  add constraint meeting_requests_proposed_duration_minutes_check check (
    proposed_duration_minutes is null
    or (proposed_duration_minutes between 15 and 180 and proposed_duration_minutes % 5 = 0)
  );

grant update (first_name, last_name, birth_date, grade, school, city, phone, languages, bio, profile_photo_path, updated_at)
  on public.mentor_profiles to service_role;

NOTIFY pgrst, 'reload schema';
