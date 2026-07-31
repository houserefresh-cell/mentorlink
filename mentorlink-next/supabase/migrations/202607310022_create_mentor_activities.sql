create table public.mentor_activities (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  subject_id bigint references public.subjects(id) on delete restrict,
  title text check (title is null or char_length(btrim(title)) between 3 and 120),
  description text check (
    description is null or char_length(btrim(description)) between 10 and 4000
  ),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'cancelled', 'completed')
  ),
  format text check (format is null or format in ('one_time', 'series')),
  location_type text check (
    location_type is null or
    location_type in (
      'mentor_home', 'mentee_home', 'school', 'public_place',
      'sports_park', 'community_center', 'sports_complex', 'online', 'other'
    )
  ),
  venue_name text check (venue_name is null or char_length(btrim(venue_name)) between 1 and 160),
  address text check (address is null or char_length(btrim(address)) between 1 and 300),
  location_details text check (
    location_details is null or char_length(btrim(location_details)) between 1 and 1000
  ),
  min_participants integer check (min_participants is null or min_participants >= 1),
  max_participants integer check (
    max_participants is null
    or (
      max_participants between 1 and 500
      and (min_participants is null or max_participants >= min_participants)
    )
  ),
  minimum_age smallint check (minimum_age is null or minimum_age between 3 and 120),
  maximum_age smallint check (maximum_age is null or maximum_age between 3 and 120),
  suitable_grades text[] not null default '{}'::text[],
  is_free boolean not null default true,
  price numeric(10, 2) not null default 0 check (price >= 0),
  registration_deadline timestamptz,
  equipment text check (equipment is null or char_length(btrim(equipment)) between 1 and 2000),
  accessibility text check (accessibility is null or char_length(btrim(accessibility)) between 1 and 2000),
  cancellation_policy text check (
    cancellation_policy is null or char_length(btrim(cancellation_policy)) between 1 and 2000
  ),
  pickup_options text[] not null default '{}'::text[],
  pickup_details text check (
    pickup_details is null
    or (
      'other' = any(pickup_options)
      and char_length(btrim(pickup_details)) between 1 and 500
    )
  ),
  published_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_activities_age_range_valid check (
    maximum_age is null or minimum_age is null or maximum_age >= minimum_age
  ),
  constraint mentor_activities_price_valid check (
    (is_free and price = 0) or (not is_free and price > 0)
  ),
  constraint mentor_activities_grades_valid check (
    suitable_grades <@ array[
      'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
      'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12', 'graduate'
    ]::text[]
  ),
  constraint mentor_activities_pickup_options_valid check (
    pickup_options <@ array['school', 'after_school', 'home', 'other']::text[]
  ),
  constraint mentor_activities_online_location_valid check (
    location_type <> 'online' or address is null
  ),
  constraint mentor_activities_status_timestamps_valid check (
    (
      status = 'draft'
      and published_at is null
      and cancelled_at is null
      and completed_at is null
    )
    or (
      status = 'published'
      and published_at is not null
      and cancelled_at is null
      and completed_at is null
    )
    or (
      status = 'cancelled'
      and published_at is not null
      and cancelled_at is not null
      and completed_at is null
    )
    or (
      status = 'completed'
      and published_at is not null
      and cancelled_at is null
      and completed_at is not null
    )
  )
);

create table public.mentor_activity_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mentor_activities(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  estimated_overrun text not null default 'none' check (
    estimated_overrun in ('none', '5_10_minutes', '15_20_minutes')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_activity_sessions_interval_valid check (ends_at > starts_at),
  constraint mentor_activity_sessions_activity_start_unique unique (activity_id, starts_at)
);

create table public.mentor_activity_registrations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mentor_activities(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  child_first_name text not null check (char_length(btrim(child_first_name)) between 1 and 60),
  child_grade_or_age text not null check (char_length(btrim(child_grade_or_age)) between 1 and 40),
  child_needs text check (child_needs is null or char_length(btrim(child_needs)) between 1 and 1000),
  status text not null default 'registered' check (
    status in ('registered', 'waitlisted', 'cancelled')
  ),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_activity_registrations_cancelled_at_valid check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  ),
  constraint mentor_activity_registration_child_unique unique (
    activity_id, parent_user_id, child_first_name
  ),
  constraint mentor_activity_registration_idempotency_unique unique (
    parent_user_id, idempotency_key
  )
);

create index mentor_activities_mentor_status_idx
  on public.mentor_activities (mentor_user_id, status, created_at desc);
create index mentor_activities_subject_published_idx
  on public.mentor_activities (subject_id, registration_deadline)
  where status = 'published';
create index mentor_activity_sessions_activity_time_idx
  on public.mentor_activity_sessions (activity_id, starts_at, ends_at);
create index mentor_activity_sessions_upcoming_idx
  on public.mentor_activity_sessions (starts_at, activity_id);
create index mentor_activity_registrations_activity_status_idx
  on public.mentor_activity_registrations (activity_id, status, created_at);
create index mentor_activity_registrations_parent_history_idx
  on public.mentor_activity_registrations (parent_user_id, created_at desc);

alter table public.mentor_activities enable row level security;
alter table public.mentor_activity_sessions enable row level security;
alter table public.mentor_activity_registrations enable row level security;

revoke all on table public.mentor_activities from anon, authenticated;
revoke all on table public.mentor_activity_sessions from anon, authenticated;
revoke all on table public.mentor_activity_registrations from anon, authenticated;

grant select, insert, update, delete
on table public.mentor_activities
to service_role;
grant select, insert, update, delete
on table public.mentor_activity_sessions
to service_role;
grant select, insert, update, delete
on table public.mentor_activity_registrations
to service_role;

create or replace function public.save_mentor_activity(
  p_activity_id uuid,
  p_mentor_user_id uuid,
  p_activity jsonb,
  p_sessions jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid := coalesce(p_activity_id, gen_random_uuid());
  v_existing_mentor uuid;
  v_existing_status text;
  v_now timestamptz := now();
begin
  if p_mentor_user_id is null then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ACTIVITY_SESSIONS' using errcode = '22023';
  end if;

  if p_activity_id is not null then
    select mentor_user_id, status into v_existing_mentor, v_existing_status
    from public.mentor_activities
    where id = p_activity_id
    for update;
    if not found then
      raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_existing_mentor <> p_mentor_user_id then
      raise exception 'ACTIVITY_NOT_OWNED' using errcode = '42501';
    end if;
    if v_existing_status <> 'draft' then
      raise exception 'ACTIVITY_NOT_EDITABLE' using errcode = '55000';
    end if;
  end if;

  if p_publish then
    perform pg_advisory_xact_lock(hashtextextended(p_mentor_user_id::text, 0));

    if exists (
      select 1
      from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb))
        as proposed(starts_at timestamptz, ends_at timestamptz, estimated_overrun text)
      join public.mentor_activity_sessions existing_session
        on tstzrange(existing_session.starts_at, existing_session.ends_at, '[)')
          && tstzrange(proposed.starts_at, proposed.ends_at, '[)')
      join public.mentor_activities existing_activity
        on existing_activity.id = existing_session.activity_id
      where existing_activity.mentor_user_id = p_mentor_user_id
        and existing_activity.status = 'published'
        and existing_activity.id <> v_activity_id
    ) then
      raise exception 'ACTIVITY_CONFLICT' using errcode = '23P01';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb))
        as proposed(starts_at timestamptz, ends_at timestamptz, estimated_overrun text)
      join public.meeting_requests meeting
        on tstzrange(
          coalesce(meeting.confirmed_start_at, meeting.requested_start_at),
          coalesce(meeting.confirmed_end_at, meeting.requested_end_at),
          '[)'
        ) && tstzrange(proposed.starts_at, proposed.ends_at, '[)')
      where meeting.mentor_user_id = p_mentor_user_id
        and meeting.status = 'accepted'
    ) then
      raise exception 'MEETING_CONFLICT' using errcode = '23P01';
    end if;
  end if;

  insert into public.mentor_activities (
    id, mentor_user_id, subject_id, title, description, status, format,
    location_type, venue_name, address, location_details,
    min_participants, max_participants, minimum_age, maximum_age,
    suitable_grades, is_free, price, registration_deadline,
    equipment, accessibility, cancellation_policy, pickup_options,
    pickup_details, published_at, cancelled_at, completed_at, updated_at
  ) values (
    v_activity_id, p_mentor_user_id,
    (p_activity ->> 'subject_id')::bigint,
    p_activity ->> 'title',
    p_activity ->> 'description',
    case when p_publish then 'published' else 'draft' end,
    p_activity ->> 'format',
    p_activity ->> 'location_type',
    p_activity ->> 'venue_name',
    p_activity ->> 'address',
    p_activity ->> 'location_details',
    (p_activity ->> 'min_participants')::integer,
    (p_activity ->> 'max_participants')::integer,
    (p_activity ->> 'minimum_age')::smallint,
    (p_activity ->> 'maximum_age')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_activity -> 'suitable_grades', '[]'::jsonb))), '{}'::text[]),
    coalesce((p_activity ->> 'is_free')::boolean, true),
    coalesce((p_activity ->> 'price')::numeric, 0),
    (p_activity ->> 'registration_deadline')::timestamptz,
    p_activity ->> 'equipment',
    p_activity ->> 'accessibility',
    p_activity ->> 'cancellation_policy',
    coalesce(array(select jsonb_array_elements_text(coalesce(p_activity -> 'pickup_options', '[]'::jsonb))), '{}'::text[]),
    p_activity ->> 'pickup_details',
    case when p_publish then v_now else null end,
    null, null, v_now
  )
  on conflict (id) do update set
    subject_id = excluded.subject_id,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    format = excluded.format,
    location_type = excluded.location_type,
    venue_name = excluded.venue_name,
    address = excluded.address,
    location_details = excluded.location_details,
    min_participants = excluded.min_participants,
    max_participants = excluded.max_participants,
    minimum_age = excluded.minimum_age,
    maximum_age = excluded.maximum_age,
    suitable_grades = excluded.suitable_grades,
    is_free = excluded.is_free,
    price = excluded.price,
    registration_deadline = excluded.registration_deadline,
    equipment = excluded.equipment,
    accessibility = excluded.accessibility,
    cancellation_policy = excluded.cancellation_policy,
    pickup_options = excluded.pickup_options,
    pickup_details = excluded.pickup_details,
    published_at = excluded.published_at,
    cancelled_at = null,
    completed_at = null,
    updated_at = v_now
  where public.mentor_activities.mentor_user_id = p_mentor_user_id
    and public.mentor_activities.status = 'draft';

  if not found then
    raise exception 'ACTIVITY_NOT_OWNED_OR_EDITABLE' using errcode = '42501';
  end if;

  delete from public.mentor_activity_sessions where activity_id = v_activity_id;
  insert into public.mentor_activity_sessions (
    activity_id, starts_at, ends_at, estimated_overrun
  )
  select v_activity_id, session.starts_at, session.ends_at,
    coalesce(session.estimated_overrun, 'none')
  from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb))
    as session(starts_at timestamptz, ends_at timestamptz, estimated_overrun text);

  return v_activity_id;
end;
$$;

revoke all on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.save_mentor_activity(uuid, uuid, jsonb, jsonb, boolean)
to service_role;
NOTIFY pgrst, 'reload schema';
