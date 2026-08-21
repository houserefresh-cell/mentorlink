-- Rich activity notifications and cross-schedule overlap protection.
create or replace function public.notify_mentor_activity_registration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
begin
  select * into v_activity from public.mentor_activities where id = new.activity_id;
  if not found then return new; end if;

  if new.status in ('registered', 'waitlisted')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      case when new.status = 'registered' then 'הרשמה חדשה לפעילות' else 'הצטרפות לרשימת ההמתנה' end,
      format('%s %s לפעילות %s.', new.child_first_name, case when new.status = 'registered' then 'נרשמ/ה' else 'הצטרפ/ה לרשימת ההמתנה' end, coalesce(v_activity.title, 'שלך')),
      format('/dashboard/mentor/activity-registrations?activity=%s&registration=%s&registration_status=%s', new.activity_id, new.id, new.status)
    );
  elsif tg_op = 'UPDATE' and old.status in ('registered', 'waitlisted') and new.status = 'cancelled'
        and v_activity.status <> 'cancelled' then
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      'ביטול הרשמה לפעילות',
      format('ההרשמה של %s לפעילות %s בוטלה.', new.child_first_name, coalesce(v_activity.title, 'שלך')),
      format('/dashboard/mentor/activity-registrations?activity=%s&registration=%s&registration_status=%s', new.activity_id, new.id, old.status)
    );
  end if;
  return new;
end;
$$;

alter table public.meeting_request_updates
  drop constraint if exists meeting_request_updates_update_type_check;
alter table public.meeting_request_updates
  add constraint meeting_request_updates_update_type_check
  check (update_type in ('cancellation', 'details', 'reschedule', 'approval'));

create or replace function public.record_parent_meeting_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_kind text;
  update_body text;
begin
  if new.status = 'cancelled' and old.status is distinct from new.status
     and nullif(btrim(new.cancellation_reason), '') is not null
     and btrim(new.cancellation_reason) <> 'המועד שהוצע חלף ללא אישור.' then
    update_kind := 'cancellation';
    update_body := 'הפגישה בוטלה על ידי החונך. ' || coalesce('הסיבה: ' || nullif(btrim(new.cancellation_reason), ''), '');
  elsif new.status = 'accepted' and old.status = 'pending' then
    update_kind := 'approval';
    update_body := 'החונך אישר את הפגישה.';
  elsif new.proposed_start_at is not null and old.proposed_start_at is distinct from new.proposed_start_at then
    update_kind := 'reschedule';
    update_body := 'החונך הציע מועד חדש לפגישה. יש לאשר או לדחות את ההצעה.';
  elsif old.preparation_notes is distinct from new.preparation_notes
        or old.equipment_notes is distinct from new.equipment_notes
        or old.meeting_location is distinct from new.meeting_location
        or old.participant_names is distinct from new.participant_names then
    update_kind := 'details';
    update_body := 'החונך עדכן את פרטי המפגש, ההכנה, הציוד או המיקום.';
  end if;

  if update_kind is not null then
    insert into public.meeting_request_updates (
      meeting_request_id, parent_user_id, update_type, body, created_at
    ) values (new.id, new.parent_user_id, update_kind, update_body, now());
  end if;
  return new;
end;
$$;

create or replace function public.guard_meeting_against_activity_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.status <> 'accepted' then return new; end if;
  v_start := coalesce(new.confirmed_start_at, new.requested_start_at);
  v_end := coalesce(new.confirmed_end_at, new.requested_end_at);
  perform pg_advisory_xact_lock(hashtextextended(new.mentor_user_id::text, 0));
  if exists (
    select 1
    from public.mentor_activities activity
    join public.mentor_activity_sessions session on session.activity_id = activity.id
    where activity.mentor_user_id = new.mentor_user_id
      and activity.status = 'published'
      and tstzrange(session.starts_at, session.ends_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    raise exception 'MENTOR_SCHEDULE_OVERLAP' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_meeting_against_activity_overlap_trigger on public.meeting_requests;
create trigger guard_meeting_against_activity_overlap_trigger
before insert or update of status, confirmed_start_at, confirmed_end_at on public.meeting_requests
for each row execute function public.guard_meeting_against_activity_overlap();

create or replace function public.guard_published_activity_session_against_meeting_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mentor uuid;
  v_status text;
begin
  select mentor_user_id, status into v_mentor, v_status
  from public.mentor_activities where id = new.activity_id;
  if v_status <> 'published' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_mentor::text, 0));
  if exists (
    select 1 from public.meeting_requests meeting
    where meeting.mentor_user_id = v_mentor and meeting.status = 'accepted'
      and tstzrange(new.starts_at, new.ends_at, '[)') &&
          tstzrange(coalesce(meeting.confirmed_start_at, meeting.requested_start_at), coalesce(meeting.confirmed_end_at, meeting.requested_end_at), '[)')
  ) then
    raise exception 'MEETING_CONFLICT' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_published_activity_session_against_meeting_overlap_trigger on public.mentor_activity_sessions;
create trigger guard_published_activity_session_against_meeting_overlap_trigger
before insert or update of starts_at, ends_at on public.mentor_activity_sessions
for each row execute function public.guard_published_activity_session_against_meeting_overlap();

notify pgrst, 'reload schema';
