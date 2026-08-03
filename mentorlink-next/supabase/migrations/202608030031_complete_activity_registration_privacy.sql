alter table public.mentor_activities
  add column if not exists contact_phone_visibility text not null default 'registered_parents';

alter table public.mentor_activities
  drop constraint if exists mentor_activities_contact_phone_visibility_allowed;

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

comment on column public.mentor_activities.contact_phone_visibility is
  'public: visible before registration; registered_parents: registered parents only; mentor_approved: registered parents after explicit mentor approval';

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
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      case when v_status = 'registered' then 'הרשמה חדשה לפעילות' else 'הצטרפות לרשימת ההמתנה' end,
      format('%s נרשמ/ה לפעילות %s.', btrim(v_child.first_name), coalesce(v_activity.title, 'שלך')),
      '/dashboard/mentor/activities'
    );
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

-- Keep the established activity save contract while persisting the new privacy
-- choice in the same transaction. The previous implementation remains private
-- and is called only by this wrapper.
alter function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
  rename to save_mentor_activity_before_contact_visibility;
revoke all on function public.save_mentor_activity_before_contact_visibility(uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;

create function public.save_mentor_activity(
  p_activity_id uuid,
  p_mentor_user_id uuid,
  p_activity jsonb,
  p_sessions jsonb,
  p_publish boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
  v_visibility text := coalesce(nullif(p_activity ->> 'contact_phone_visibility', ''), 'registered_parents');
  v_birth_date date;
begin
  if v_visibility not in ('public', 'registered_parents', 'mentor_approved') then
    raise exception 'INVALID_CONTACT_PHONE_VISIBILITY' using errcode = '22023';
  end if;

  if v_visibility = 'public' then
    select birth_date into v_birth_date
    from public.mentor_profiles
    where user_id = p_mentor_user_id;

    if v_birth_date is not null
       and v_birth_date > current_date - interval '18 years'
       and not exists (
         select 1
         from public.mentor_parent_consents
         where user_id = p_mentor_user_id
           and status = 'approved'
           and contact_confirmed = true
       ) then
      raise exception 'PUBLIC_PHONE_REQUIRES_PARENT_CONSENT' using errcode = '42501';
    end if;
  end if;

  v_activity_id := public.save_mentor_activity_before_contact_visibility(
    p_activity_id, p_mentor_user_id, p_activity, p_sessions, p_publish
  );

  update public.mentor_activities
  set contact_phone_visibility = v_visibility
  where id = v_activity_id and mentor_user_id = p_mentor_user_id;

  if not found then
    raise exception 'ACTIVITY_CONTACT_VISIBILITY_NOT_SAVED' using errcode = 'P0002';
  end if;
  return v_activity_id;
end;
$$;

revoke all on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
to service_role;

-- Revoke per-parent contact approval as soon as that parent's last active
-- registration is cancelled. Public phone visibility remains public by choice.
create or replace function public.cancel_parent_activity_registration(
  p_registration_id uuid,
  p_parent_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
  v_cancelled_status text;
  v_promoted_parent uuid;
begin
  select activity_id into v_activity_id
  from public.mentor_activity_registrations
  where id = p_registration_id and parent_user_id = p_parent_user_id;
  if not found then raise exception 'REGISTRATION_NOT_CANCELLABLE' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_activity_id::text, 0));
  select status into v_cancelled_status
  from public.mentor_activity_registrations
  where id = p_registration_id and parent_user_id = p_parent_user_id
    and status in ('registered', 'waitlisted') for update;
  if not found then raise exception 'REGISTRATION_NOT_CANCELLABLE' using errcode = '42501'; end if;

  update public.mentor_activity_registrations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_registration_id;

  if not exists (
    select 1 from public.mentor_activity_registrations
    where activity_id = v_activity_id and parent_user_id = p_parent_user_id
      and status = 'registered'
  ) then
    delete from public.mentor_activity_contact_approvals
    where activity_id = v_activity_id and parent_user_id = p_parent_user_id;
  end if;

  if v_cancelled_status = 'registered' then
    update public.mentor_activity_registrations
    set status = 'registered', updated_at = now()
    where id = (
      select id from public.mentor_activity_registrations
      where activity_id = v_activity_id and status = 'waitlisted'
      order by created_at for update skip locked limit 1
    )
    returning parent_user_id into v_promoted_parent;

    if v_promoted_parent is not null then
      insert into public.notifications(user_id, kind, title, body, href)
      values (v_promoted_parent, 'mentor_activity_update', 'התפנה מקום בפעילות',
        'ההרשמה עברה מרשימת ההמתנה לרשימת המשתתפים.', '/dashboard/parent/activities');
    end if;
  end if;
  return v_activity_id;
end;
$$;

revoke all on function public.cancel_parent_activity_registration(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.cancel_parent_activity_registration(uuid, uuid)
to service_role;

notify pgrst, 'reload schema';
