alter table public.mentor_availability_windows
  drop constraint if exists mentor_availability_windows_meeting_price_check;

alter table public.mentor_availability_windows
  add constraint mentor_availability_windows_meeting_price_check
  check (meeting_price >= 0 and meeting_price <= 99999999.99);

alter table public.subjects
  drop constraint if exists subjects_category_allowed;

alter table public.subjects
  drop constraint if exists subjects_category_nonblank;

alter table public.subjects
  add constraint subjects_category_nonblank
  check (char_length(btrim(category)) between 2 and 50);

update public.meeting_requests
set cancellation_reason = coalesce(
  nullif(btrim(cancellation_reason), ''),
  nullif(btrim(mentor_response), ''),
  'הבקשה בוטלה.'
)
where status in ('cancelled', 'declined')
  and char_length(btrim(coalesce(cancellation_reason, ''))) < 3;

alter table public.meeting_requests
  drop constraint if exists meeting_requests_cancelled_reason_required;

alter table public.meeting_requests
  add constraint meeting_requests_cancelled_reason_required
  check (
    status not in ('cancelled', 'declined')
    or char_length(btrim(coalesce(cancellation_reason, ''))) >= 3
  );

notify pgrst, 'reload schema';
