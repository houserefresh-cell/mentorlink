create or replace function public.save_mentor_activity(
  p_activity_id uuid, p_mentor_user_id uuid, p_activity jsonb,
  p_sessions jsonb, p_publish boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid := coalesce(p_activity_id, gen_random_uuid());
  v_existing_status text;
  v_existing_published_at timestamptz;
  v_should_publish boolean := coalesce(p_publish, false);
  v_now timestamptz := now();
begin
  if p_mentor_user_id is null then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ACTIVITY_SESSIONS' using errcode = '22023';
  end if;

  if p_activity_id is not null then
    select status, published_at into v_existing_status, v_existing_published_at
    from public.mentor_activities
    where id = p_activity_id and mentor_user_id = p_mentor_user_id
    for update;
    if not found then raise exception 'ACTIVITY_NOT_OWNED' using errcode = '42501'; end if;
    if v_existing_status not in ('draft', 'published') then
      raise exception 'ACTIVITY_NOT_EDITABLE' using errcode = '55000';
    end if;
    if exists (
      select 1 from public.mentor_activity_registrations
      where activity_id = p_activity_id and status in ('registered', 'waitlisted')
    ) then
      raise exception 'ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS' using errcode = '55000';
    end if;
    v_should_publish := v_should_publish or v_existing_status = 'published';
  end if;

  if v_should_publish then
    perform pg_advisory_xact_lock(hashtextextended(p_mentor_user_id::text, 0));
    if exists (
      select 1
      from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) proposed(starts_at timestamptz, ends_at timestamptz, estimated_overrun text)
      join public.mentor_activity_sessions existing_session
        on tstzrange(existing_session.starts_at, existing_session.ends_at, '[)') && tstzrange(proposed.starts_at, proposed.ends_at, '[)')
      join public.mentor_activities existing_activity on existing_activity.id = existing_session.activity_id
      where existing_activity.mentor_user_id = p_mentor_user_id
        and existing_activity.status = 'published' and existing_activity.id <> v_activity_id
    ) then raise exception 'ACTIVITY_CONFLICT' using errcode = '23P01'; end if;
    if exists (
      select 1
      from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) proposed(starts_at timestamptz, ends_at timestamptz, estimated_overrun text)
      join public.meeting_requests meeting
        on tstzrange(coalesce(meeting.confirmed_start_at, meeting.requested_start_at), coalesce(meeting.confirmed_end_at, meeting.requested_end_at), '[)')
          && tstzrange(proposed.starts_at, proposed.ends_at, '[)')
      where meeting.mentor_user_id = p_mentor_user_id and meeting.status = 'accepted'
    ) then raise exception 'MEETING_CONFLICT' using errcode = '23P01'; end if;
  end if;

  insert into public.mentor_activities (
    id, mentor_user_id, subject_id, title, description, status, format, location_type,
    venue_name, address, location_details, min_participants, max_participants,
    minimum_age, maximum_age, suitable_grades, is_free, price, registration_deadline,
    equipment, accessibility, cancellation_policy, pickup_options, pickup_details,
    published_at, cancelled_at, completed_at, updated_at
  ) values (
    v_activity_id, p_mentor_user_id, (p_activity ->> 'subject_id')::bigint,
    p_activity ->> 'title', p_activity ->> 'description',
    case when v_should_publish then 'published' else 'draft' end,
    p_activity ->> 'format', p_activity ->> 'location_type', p_activity ->> 'venue_name',
    p_activity ->> 'address', p_activity ->> 'location_details',
    (p_activity ->> 'min_participants')::integer, (p_activity ->> 'max_participants')::integer,
    (p_activity ->> 'minimum_age')::smallint, (p_activity ->> 'maximum_age')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_activity -> 'suitable_grades', '[]'::jsonb))), '{}'::text[]),
    coalesce((p_activity ->> 'is_free')::boolean, true), coalesce((p_activity ->> 'price')::numeric, 0),
    (p_activity ->> 'registration_deadline')::timestamptz, p_activity ->> 'equipment',
    p_activity ->> 'accessibility', p_activity ->> 'cancellation_policy',
    coalesce(array(select jsonb_array_elements_text(coalesce(p_activity -> 'pickup_options', '[]'::jsonb))), '{}'::text[]),
    p_activity ->> 'pickup_details', case when v_should_publish then coalesce(v_existing_published_at, v_now) end,
    null, null, v_now
  )
  on conflict (id) do update set
    subject_id = excluded.subject_id, title = excluded.title, description = excluded.description,
    status = excluded.status, format = excluded.format, location_type = excluded.location_type,
    venue_name = excluded.venue_name, address = excluded.address, location_details = excluded.location_details,
    min_participants = excluded.min_participants, max_participants = excluded.max_participants,
    minimum_age = excluded.minimum_age, maximum_age = excluded.maximum_age,
    suitable_grades = excluded.suitable_grades, is_free = excluded.is_free, price = excluded.price,
    registration_deadline = excluded.registration_deadline, equipment = excluded.equipment,
    accessibility = excluded.accessibility, cancellation_policy = excluded.cancellation_policy,
    pickup_options = excluded.pickup_options, pickup_details = excluded.pickup_details,
    published_at = excluded.published_at, cancelled_at = null, completed_at = null, updated_at = v_now
  where public.mentor_activities.mentor_user_id = p_mentor_user_id
    and public.mentor_activities.status in ('draft', 'published');
  if not found then raise exception 'ACTIVITY_NOT_OWNED_OR_EDITABLE' using errcode = '42501'; end if;

  delete from public.mentor_activity_sessions where activity_id = v_activity_id;
  insert into public.mentor_activity_sessions(activity_id, starts_at, ends_at, estimated_overrun)
  select v_activity_id, session.starts_at, session.ends_at, coalesce(session.estimated_overrun, 'none')
  from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) session(starts_at timestamptz, ends_at timestamptz, estimated_overrun text);
  return v_activity_id;
end;
$$;

revoke all on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean) to service_role;
notify pgrst, 'reload schema';
