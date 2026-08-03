alter table public.mentor_activities
  add column contact_phone_visibility text not null default 'registered_parents';

alter table public.mentor_activities
  add constraint mentor_activities_contact_phone_visibility_allowed
  check (contact_phone_visibility in ('public', 'registered_parents', 'mentor_approved'));

create table public.mentor_activity_contact_approvals (
  activity_id uuid not null references public.mentor_activities(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  primary key (activity_id, parent_user_id)
);

alter table public.mentor_activity_contact_approvals enable row level security;
revoke all on public.mentor_activity_contact_approvals from public, anon, authenticated;
grant select, insert, delete on public.mentor_activity_contact_approvals to service_role;

create index mentor_activity_contact_approvals_parent_idx
  on public.mentor_activity_contact_approvals(parent_user_id, activity_id);

create or replace function public.set_activity_contact_approval(
  p_activity_id uuid,
  p_mentor_user_id uuid,
  p_parent_user_id uuid,
  p_approved boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.mentor_activities
    where id = p_activity_id and mentor_user_id = p_mentor_user_id
  ) then
    raise exception 'ACTIVITY_NOT_OWNED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.mentor_activity_registrations
    where activity_id = p_activity_id and parent_user_id = p_parent_user_id
      and status = 'registered'
  ) then
    raise exception 'PARENT_NOT_REGISTERED' using errcode = '22023';
  end if;
  if p_approved then
    insert into public.mentor_activity_contact_approvals(activity_id, parent_user_id, approved_by)
    values (p_activity_id, p_parent_user_id, p_mentor_user_id)
    on conflict (activity_id, parent_user_id) do update
      set approved_by = excluded.approved_by, approved_at = now();
  else
    delete from public.mentor_activity_contact_approvals
    where activity_id = p_activity_id and parent_user_id = p_parent_user_id;
  end if;
end;
$$;

revoke all on function public.set_activity_contact_approval(uuid, uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.set_activity_contact_approval(uuid, uuid, uuid, boolean)
to service_role;

create or replace function public.register_children_for_activity(
  p_activity_id uuid,
  p_parent_user_id uuid,
  p_child_ids uuid[],
  p_idempotency_keys uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
  v_child public.parent_children%rowtype;
  v_existing public.mentor_activity_registrations%rowtype;
  v_child_id uuid;
  v_key uuid;
  v_position integer;
  v_registered_count integer;
  v_status text;
  v_results jsonb := '[]'::jsonb;
begin
  if p_parent_user_id is null or coalesce(cardinality(p_child_ids), 0) = 0
    or cardinality(p_child_ids) <> cardinality(p_idempotency_keys)
    or cardinality(p_child_ids) > 10 then
    raise exception 'INVALID_ACTIVITY_REGISTRATION' using errcode = '22023';
  end if;
  if cardinality(p_child_ids) <> (select count(distinct value) from unnest(p_child_ids) value)
    or cardinality(p_idempotency_keys) <> (select count(distinct value) from unnest(p_idempotency_keys) value) then
    raise exception 'DUPLICATE_REGISTRATION_INPUT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_activity_id::text, 0));
  select * into v_activity from public.mentor_activities
    where id = p_activity_id and status = 'published' for update;
  if not found then raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_activity.registration_deadline is null or v_activity.registration_deadline <= now() then
    raise exception 'REGISTRATION_CLOSED' using errcode = '22023';
  end if;
  if not exists (select 1 from public.mentor_activity_sessions where activity_id = p_activity_id and starts_at > now()) then
    raise exception 'ACTIVITY_ALREADY_STARTED' using errcode = '22023';
  end if;

  for v_position in 1..cardinality(p_child_ids) loop
    v_child_id := p_child_ids[v_position]; v_key := p_idempotency_keys[v_position];
    select * into v_child from public.parent_children
      where id = v_child_id and parent_user_id = p_parent_user_id;
    if not found then raise exception 'CHILD_NOT_OWNED' using errcode = '42501'; end if;

    select * into v_existing from public.mentor_activity_registrations
      where parent_user_id = p_parent_user_id and idempotency_key = v_key;
    if found then
      if v_existing.activity_id <> p_activity_id or v_existing.child_id <> v_child_id then
        raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
      end if;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_existing.id, 'childId', v_existing.child_id,
        'childFirstName', v_existing.child_first_name, 'status', v_existing.status));
      continue;
    end if;

    if exists (select 1 from public.mentor_activity_registrations
      where activity_id = p_activity_id and child_id = v_child_id
        and status in ('registered', 'waitlisted')) then
      raise exception 'CHILD_ALREADY_REGISTERED' using errcode = '23505';
    end if;
    select count(*) into v_registered_count from public.mentor_activity_registrations
      where activity_id = p_activity_id and status = 'registered';
    v_status := case when v_registered_count < v_activity.max_participants then 'registered' else 'waitlisted' end;
    insert into public.mentor_activity_registrations(
      activity_id, parent_user_id, child_id, idempotency_key,
      child_first_name, child_grade_or_age, child_needs, status
    ) values (
      p_activity_id, p_parent_user_id, v_child.id, v_key, btrim(v_child.first_name),
      coalesce(v_child.grade, 'not_provided'), nullif(btrim(v_child.accommodation_notes), ''), v_status
    ) returning * into v_existing;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_existing.id, 'childId', v_child.id,
      'childFirstName', v_child.first_name, 'status', v_status));
  end loop;
  return v_results;
end;
$$;

revoke all on function public.register_children_for_activity(uuid, uuid, uuid[], uuid[])
from public, anon, authenticated;
grant execute on function public.register_children_for_activity(uuid, uuid, uuid[], uuid[])
to service_role;

notify pgrst, 'reload schema';
