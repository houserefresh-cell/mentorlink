create extension if not exists btree_gist with schema extensions;

alter table public.mentor_publication
  add column public_booking_id uuid not null default gen_random_uuid(),
  add constraint mentor_publication_public_booking_id_unique unique (public_booking_id);

create table public.mentor_availability_windows (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  meeting_mode text not null check (meeting_mode in ('פרונטלי', 'אונליין')),
  supported_durations integer[] not null,
  is_active boolean not null default true,
  effective_start_date date,
  effective_end_date date,
  timezone text not null default 'Asia/Jerusalem'
    check (timezone = 'Asia/Jerusalem'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_availability_window_times_valid check (end_time > start_time),
  constraint mentor_availability_window_dates_valid check (
    effective_end_date is null
    or effective_start_date is null
    or effective_end_date >= effective_start_date
  ),
  constraint mentor_availability_window_durations_valid check (
    cardinality(supported_durations) > 0
    and supported_durations <@ array[30, 45, 60, 90]
  )
);

create table public.mentor_blackout_periods (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  constraint mentor_blackout_period_times_valid check (ends_at > starts_at)
);

create table public.administrator_blackout_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint administrator_blackout_period_times_valid check (ends_at > starts_at)
);
create table public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 120),
  child_first_name text not null check (char_length(child_first_name) between 1 and 60),
  child_grade_or_age text not null check (char_length(child_grade_or_age) between 1 and 40),
  help_goal text not null check (char_length(help_goal) between 5 and 500),
  meeting_mode text not null check (meeting_mode in ('פרונטלי', 'אונליין')),
  requested_start_at timestamptz not null,
  requested_duration_minutes integer not null check (
    requested_duration_minutes in (30, 45, 60, 90)
  ),
  parent_message text check (parent_message is null or char_length(parent_message) <= 500),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'alternative_proposed', 'cancelled')
  ),
  mentor_response text check (mentor_response is null or char_length(mentor_response) <= 500),
  proposed_start_at timestamptz,
  proposed_duration_minutes integer check (
    proposed_duration_minutes is null
    or proposed_duration_minutes in (30, 45, 60, 90)
  ),
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_requests_idempotency_unique unique (parent_user_id, idempotency_key)
);

alter table public.meeting_requests
  add constraint meeting_requests_no_accepted_overlap
  exclude using gist (
    mentor_user_id with =,
    tstzrange(
      requested_start_at,
      requested_start_at + make_interval(mins => requested_duration_minutes),
      '[)'
    ) with &&
  )
  where (status = 'accepted');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('meeting_request_created', 'meeting_request_accepted',
      'meeting_request_declined', 'meeting_alternative_proposed',
      'meeting_request_cancelled')
  ),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 240),
  href text not null check (char_length(href) between 1 and 240),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index mentor_availability_windows_active_idx
  on public.mentor_availability_windows (mentor_user_id, weekday)
  where is_active;
create index mentor_blackout_periods_lookup_idx
  on public.mentor_blackout_periods (mentor_user_id, starts_at, ends_at);
create index administrator_blackout_periods_lookup_idx
  on public.administrator_blackout_periods (starts_at, ends_at);
create index meeting_requests_parent_history_idx
  on public.meeting_requests (parent_user_id, created_at desc);
create index meeting_requests_mentor_inbox_idx
  on public.meeting_requests (mentor_user_id, status, created_at desc);
create index meeting_requests_mentor_time_idx
  on public.meeting_requests (mentor_user_id, requested_start_at)
  where status = 'accepted';
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.mentor_availability_windows enable row level security;
alter table public.mentor_blackout_periods enable row level security;
alter table public.administrator_blackout_periods enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.notifications enable row level security;

revoke all on public.mentor_availability_windows from anon, authenticated;
revoke all on public.mentor_blackout_periods from anon, authenticated;
revoke all on public.administrator_blackout_periods from anon, authenticated;
revoke all on public.meeting_requests from anon, authenticated;
revoke all on public.notifications from anon, authenticated;

grant select, insert, update, delete on public.mentor_availability_windows to service_role;
grant select, insert, update, delete on public.mentor_blackout_periods to service_role;
grant select, insert, update, delete on public.administrator_blackout_periods to service_role;
grant select, insert, update on public.meeting_requests to service_role;
grant select, insert, update, delete on public.notifications to service_role;
grant select on public.mentor_availability_windows to authenticated;
grant select on public.mentor_blackout_periods to authenticated;
grant select on public.meeting_requests to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select (public_booking_id) on public.mentor_publication to service_role;

create policy "Mentors read their scheduling availability"
on public.mentor_availability_windows for select to authenticated
using (mentor_user_id = auth.uid());

create policy "Mentors read their scheduling blackouts"
on public.mentor_blackout_periods for select to authenticated
using (mentor_user_id = auth.uid());

create policy "Participants read their meeting requests"
on public.meeting_requests for select to authenticated
using (parent_user_id = auth.uid() or mentor_user_id = auth.uid());

create policy "Users read their notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy "Users mark their notifications read"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
