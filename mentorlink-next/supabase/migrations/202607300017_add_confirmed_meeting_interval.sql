alter table public.meeting_requests
  add column confirmed_start_at timestamptz,
  add column confirmed_end_at timestamptz,
  add column confirmed_duration_minutes integer,
  add constraint meeting_requests_confirmed_interval_valid check (
    (
      confirmed_start_at is null
      and confirmed_end_at is null
      and confirmed_duration_minutes is null
    )
    or (
      confirmed_start_at is not null
      and confirmed_end_at is not null
      and confirmed_duration_minutes between 15 and 180
      and confirmed_duration_minutes % 5 = 0
      and confirmed_end_at = confirmed_start_at + confirmed_duration_minutes * interval '1 minute'
    )
  );

alter table public.meeting_requests
  drop constraint meeting_requests_no_accepted_overlap;

alter table public.meeting_requests
  add constraint meeting_requests_no_accepted_overlap
  exclude using gist (
    mentor_user_id with =,
    tstzrange(
      coalesce(confirmed_start_at, requested_start_at),
      coalesce(confirmed_end_at, requested_end_at),
      '[)'
    ) with &&
  )
  where (status = 'accepted');

grant update (
  confirmed_start_at,
  confirmed_end_at,
  confirmed_duration_minutes
)
on public.meeting_requests
to service_role;

NOTIFY pgrst, 'reload schema';