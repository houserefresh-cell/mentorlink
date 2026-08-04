comment on column public.mentor_activities.contact_phone_visibility is
  'public: visible before registration; registered_parents: registered parents only; mentor_approved: registered parents after explicit mentor approval';

-- Notify the activity owner after a new active registration without changing
-- the registration RPC that migration 031 already installed in production.
create or replace function public.notify_mentor_activity_registration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
begin
  if new.status not in ('registered', 'waitlisted') then
    return new;
  end if;

  select * into v_activity
  from public.mentor_activities
  where id = new.activity_id;

  if found then
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      case when new.status = 'registered'
        then 'הרשמה חדשה לפעילות'
        else 'הצטרפות לרשימת ההמתנה'
      end,
      format('%s נרשמ/ה לפעילות %s.', new.child_first_name, coalesce(v_activity.title, 'שלך')),
      '/dashboard/mentor/activities'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists mentor_activity_registration_notification
on public.mentor_activity_registrations;
create trigger mentor_activity_registration_notification
after insert on public.mentor_activity_registrations
for each row execute function public.notify_mentor_activity_registration();

revoke all on function public.notify_mentor_activity_registration()
from public, anon, authenticated;
grant execute on function public.notify_mentor_activity_registration()
to service_role;

-- Preserve the established activity-save implementation and persist the new
-- contact policy in the same transaction through a private wrapper. Some
-- environments already received this private function from the first version
-- of migration 031, so only rename the public implementation when needed.
do $$
begin
  if to_regprocedure(
    'public.save_mentor_activity_before_contact_visibility(uuid,uuid,jsonb,jsonb,boolean)'
  ) is null then
    alter function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
      rename to save_mentor_activity_before_contact_visibility;
  end if;
end;
$$;
revoke all on function public.save_mentor_activity_before_contact_visibility(uuid, uuid, jsonb, jsonb, boolean)
from public, anon, authenticated, service_role;

create or replace function public.save_mentor_activity(
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

-- Cancellation revokes stale per-parent approval and promotes the oldest
-- waitlisted child when a confirmed place becomes free.
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
  if not found then
    raise exception 'REGISTRATION_NOT_CANCELLABLE' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_activity_id::text, 0));
  select status into v_cancelled_status
  from public.mentor_activity_registrations
  where id = p_registration_id and parent_user_id = p_parent_user_id
    and status in ('registered', 'waitlisted')
  for update;
  if not found then
    raise exception 'REGISTRATION_NOT_CANCELLABLE' using errcode = '42501';
  end if;

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
      order by created_at
      for update skip locked
      limit 1
    )
    returning parent_user_id into v_promoted_parent;

    if v_promoted_parent is not null then
      insert into public.notifications(user_id, kind, title, body, href)
      values (
        v_promoted_parent,
        'mentor_activity_update',
        'התפנה מקום בפעילות',
        'ההרשמה עברה מרשימת ההמתנה לרשימת המשתתפים.',
        '/dashboard/parent/activities'
      );
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
