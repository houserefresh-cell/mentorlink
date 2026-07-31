create table public.mentor_activity_updates (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mentor_activities(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_scope text not null check (recipient_scope in ('all_active', 'parent')),
  recipient_parent_user_id uuid references auth.users(id) on delete restrict,
  update_type text not null check (update_type in (
    'operational', 'reminder', 'equipment', 'meeting_point', 'delay',
    'postponement', 'cancellation', 'general'
  )),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  delay_minutes integer check (delay_minutes between 1 and 240),
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mentor_activity_updates_recipient_check check (
    (recipient_scope = 'all_active' and recipient_parent_user_id is null)
    or (recipient_scope = 'parent' and recipient_parent_user_id is not null)
  ),
  constraint mentor_activity_updates_delay_check check (
    (update_type = 'delay' and delay_minutes is not null)
    or (update_type <> 'delay' and delay_minutes is null)
  ),
  constraint mentor_activity_updates_postponement_check check (
    (update_type = 'postponement' and proposed_start_at is not null
      and proposed_end_at is not null and proposed_start_at < proposed_end_at)
    or (update_type <> 'postponement' and proposed_start_at is null and proposed_end_at is null)
  )
);

create index mentor_activity_updates_activity_created_idx
  on public.mentor_activity_updates(activity_id, created_at desc);
create index mentor_activity_updates_parent_created_idx
  on public.mentor_activity_updates(recipient_parent_user_id, created_at desc)
  where recipient_parent_user_id is not null;

alter table public.mentor_activity_updates enable row level security;
revoke all on public.mentor_activity_updates from public, anon, authenticated;
grant select, insert on public.mentor_activity_updates to service_role;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'meeting_request_created', 'meeting_request_accepted', 'meeting_request_declined',
  'meeting_alternative_proposed', 'meeting_request_cancelled', 'mentor_inquiry_created',
  'mentor_inquiry_responded', 'mentor_inquiry_closed', 'mentor_inquiry_cancelled',
  'mentor_activity_update'
));

alter function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
  rename to save_mentor_activity_022;
revoke all on function public.save_mentor_activity_022(uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;

create function public.save_mentor_activity(
  p_activity_id uuid, p_mentor_user_id uuid, p_activity jsonb,
  p_sessions jsonb, p_publish boolean default false
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status text;
  v_published_at timestamptz;
  v_result uuid;
begin
  if p_activity_id is not null then
    select status, published_at into v_status, v_published_at
    from public.mentor_activities
    where id = p_activity_id and mentor_user_id = p_mentor_user_id
    for update;
    if not found then raise exception 'ACTIVITY_NOT_OWNED' using errcode = '42501'; end if;
    if v_status not in ('draft', 'published') then
      raise exception 'ACTIVITY_NOT_EDITABLE' using errcode = '55000';
    end if;
    if exists (
      select 1 from public.mentor_activity_registrations
      where activity_id = p_activity_id and status in ('registered', 'waitlisted')
    ) then
      raise exception 'ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS' using errcode = '55000';
    end if;
    if v_status = 'published' then
      update public.mentor_activities set status = 'draft' where id = p_activity_id;
    end if;
  end if;

  v_result := public.save_mentor_activity_022(
    p_activity_id, p_mentor_user_id, p_activity, p_sessions,
    p_publish or v_status = 'published'
  );
  if v_status = 'published' then
    update public.mentor_activities set published_at = v_published_at where id = v_result;
  end if;
  return v_result;
end;
$$;

create function public.create_mentor_activity_update(
  p_activity_id uuid, p_sender_user_id uuid, p_recipient_scope text,
  p_recipient_parent_user_id uuid, p_update_type text, p_body text,
  p_delay_minutes integer default null, p_proposed_start_at timestamptz default null,
  p_proposed_end_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_update_id uuid;
begin
  if p_recipient_scope not in ('all_active', 'parent')
    or p_update_type not in ('operational', 'reminder', 'equipment', 'meeting_point', 'delay', 'postponement', 'cancellation', 'general')
    or char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'INVALID_ACTIVITY_UPDATE' using errcode = '22023';
  end if;
  perform 1 from public.mentor_activities
    where id = p_activity_id and mentor_user_id = p_sender_user_id
      and (status = 'published' or (p_update_type = 'cancellation' and status = 'cancelled')) for update;
  if not found then raise exception 'ACTIVITY_NOT_OWNED' using errcode = '42501'; end if;
  if p_recipient_scope = 'parent' and not exists (
    select 1 from public.mentor_activity_registrations where activity_id = p_activity_id
      and parent_user_id = p_recipient_parent_user_id and status in ('registered', 'waitlisted')
  ) then raise exception 'RECIPIENT_NOT_REGISTERED' using errcode = '42501'; end if;
  if p_recipient_scope = 'all_active' and not exists (
    select 1 from public.mentor_activity_registrations where activity_id = p_activity_id
      and status in ('registered', 'waitlisted')
  ) then raise exception 'NO_ACTIVE_RECIPIENTS' using errcode = '22023'; end if;

  insert into public.mentor_activity_updates(activity_id, sender_user_id, recipient_scope,
    recipient_parent_user_id, update_type, body, delay_minutes, proposed_start_at, proposed_end_at)
  values (p_activity_id, p_sender_user_id, p_recipient_scope, p_recipient_parent_user_id,
    p_update_type, btrim(p_body), p_delay_minutes, p_proposed_start_at, p_proposed_end_at)
  returning id into v_update_id;

  insert into public.notifications(user_id, kind, title, body, href)
  select distinct r.parent_user_id, 'mentor_activity_update', 'עדכון לפעילות',
    left(btrim(p_body), 240), '/dashboard/parent'
  from public.mentor_activity_registrations r
  where r.activity_id = p_activity_id and r.status in ('registered', 'waitlisted')
    and (p_recipient_scope = 'all_active' or r.parent_user_id = p_recipient_parent_user_id);
  return v_update_id;
end;
$$;

create function public.cancel_mentor_activity_with_update(
  p_activity_id uuid, p_mentor_user_id uuid, p_reason text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_update_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'CANCELLATION_REASON_REQUIRED' using errcode = '22023';
  end if;
  update public.mentor_activities set status = 'cancelled', cancelled_at = now(),
    completed_at = null, updated_at = now()
  where id = p_activity_id and mentor_user_id = p_mentor_user_id and status = 'published';
  if not found then raise exception 'ACTIVITY_NOT_OWNED_OR_CANCELLABLE' using errcode = '42501'; end if;
  if exists (select 1 from public.mentor_activity_registrations where activity_id = p_activity_id
    and status in ('registered', 'waitlisted')) then
    v_update_id := public.create_mentor_activity_update(p_activity_id, p_mentor_user_id,
      'all_active', null, 'cancellation', p_reason, null, null, null);
  end if;
  return v_update_id;
end;
$$;

revoke all on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean),
  public.create_mentor_activity_update(uuid, uuid, text, uuid, text, text, integer, timestamptz, timestamptz),
  public.cancel_mentor_activity_with_update(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean),
  public.create_mentor_activity_update(uuid, uuid, text, uuid, text, text, integer, timestamptz, timestamptz),
  public.cancel_mentor_activity_with_update(uuid, uuid, text)
to service_role;

notify pgrst, 'reload schema';
