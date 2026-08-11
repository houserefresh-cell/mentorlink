-- Repair cancelled activities created before migration 035 and make every
-- future restore cancel stale registrations atomically before reopening a draft.
update public.mentor_activity_registrations as registration
set status = 'cancelled',
    cancelled_at = coalesce(registration.cancelled_at, now()),
    updated_at = now()
from public.mentor_activities as activity
where activity.id = registration.activity_id
  and activity.status = 'cancelled'
  and registration.status in ('registered', 'waitlisted');

create or replace function public.restore_mentor_activity_as_draft(
  p_activity_id uuid,
  p_mentor_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_activity_id::text, 0));

  select id into v_activity_id
  from public.mentor_activities
  where id = p_activity_id
    and mentor_user_id = p_mentor_user_id
    and status = 'cancelled'
  for update;

  if not found then
    raise exception 'ACTIVITY_NOT_RESTORABLE' using errcode = '42501';
  end if;

  -- Old registrations never return automatically when an activity is revived.
  update public.mentor_activity_registrations
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where activity_id = p_activity_id
    and status in ('registered', 'waitlisted');

  update public.mentor_activities
  set status = 'draft',
      cancelled_at = null,
      completed_at = null,
      updated_at = now()
  where id = p_activity_id;

  return v_activity_id;
end;
$$;

revoke all on function public.restore_mentor_activity_as_draft(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.restore_mentor_activity_as_draft(uuid, uuid)
to service_role;

notify pgrst, 'reload schema';
