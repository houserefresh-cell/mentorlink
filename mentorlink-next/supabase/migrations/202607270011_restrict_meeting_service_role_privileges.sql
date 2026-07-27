revoke select, insert, update, delete, truncate, references, trigger, maintain
on table public.mentor_availability_windows
from service_role;

revoke select, insert, update, delete, truncate, references, trigger, maintain
on table public.mentor_blackout_periods
from service_role;

revoke select, insert, update, delete, truncate, references, trigger, maintain
on table public.administrator_blackout_periods
from service_role;

revoke select, insert, update, delete, truncate, references, trigger, maintain
on table public.meeting_requests
from service_role;

revoke select, insert, update, delete, truncate, references, trigger, maintain
on table public.notifications
from service_role;

grant select, insert, delete
on table public.mentor_availability_windows
to service_role;

grant update (
  weekday,
  start_time,
  end_time,
  meeting_mode,
  supported_durations,
  is_active,
  effective_start_date,
  effective_end_date,
  timezone,
  updated_at
)
on public.mentor_availability_windows
to service_role;

grant select, insert, delete
on table public.mentor_blackout_periods
to service_role;

grant select
on table public.administrator_blackout_periods
to service_role;

grant select, insert
on table public.meeting_requests
to service_role;

grant update (
  status,
  mentor_response,
  proposed_start_at,
  proposed_duration_minutes,
  responded_at,
  cancelled_at,
  requested_end_at,
  updated_at
)
on public.meeting_requests
to service_role;

grant select, insert
on table public.notifications
to service_role;

grant update (read_at)
on public.notifications
to service_role;
