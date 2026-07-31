alter table public.mentor_availability_windows
  drop constraint if exists mentor_availability_window_durations_valid,
  add constraint mentor_availability_window_durations_valid check (
    cardinality(supported_durations) > 0
    and array_position(supported_durations, null) is null
    and 10 <= all(supported_durations)
    and 180 >= all(supported_durations)
  );

alter table public.meeting_requests
  drop constraint if exists meeting_requests_requested_duration_minutes_check,
  add constraint meeting_requests_requested_duration_minutes_check check (
    requested_duration_minutes between 10 and 180
  ),
  drop constraint if exists meeting_requests_proposed_duration_minutes_check,
  add constraint meeting_requests_proposed_duration_minutes_check check (
    proposed_duration_minutes is null
    or proposed_duration_minutes between 10 and 180
  ),
  drop constraint if exists meeting_requests_confirmed_interval_valid,
  add constraint meeting_requests_confirmed_interval_valid check (
    (
      confirmed_start_at is null
      and confirmed_end_at is null
      and confirmed_duration_minutes is null
    )
    or (
      confirmed_start_at is not null
      and confirmed_end_at is not null
      and confirmed_duration_minutes between 10 and 180
      and confirmed_end_at = confirmed_start_at + confirmed_duration_minutes * interval '1 minute'
    )
  );

NOTIFY pgrst, 'reload schema';
