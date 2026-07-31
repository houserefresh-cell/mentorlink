create table public.mentor_activities (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  subject_id bigint not null references public.subjects(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (
    description is null or char_length(btrim(description)) between 10 and 4000
  ),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'cancelled', 'completed')
  ),
  format text not null check (format in ('one_time', 'series')),
  location_type text not null check (
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
  min_participants integer not null check (min_participants >= 1),
  max_participants integer not null check (
    max_participants between 1 and 500 and max_participants >= min_participants
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
  constraint mentor_activities_audience_present check (
    minimum_age is not null or maximum_age is not null or cardinality(suitable_grades) > 0
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

NOTIFY pgrst, 'reload schema';
