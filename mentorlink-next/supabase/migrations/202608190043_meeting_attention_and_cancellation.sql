alter table public.meeting_requests
  add column if not exists cancellation_reason text;

alter table public.meeting_requests
  drop constraint if exists meeting_requests_cancellation_reason_length;

alter table public.meeting_requests
  add constraint meeting_requests_cancellation_reason_length
  check (cancellation_reason is null or char_length(btrim(cancellation_reason)) between 3 and 500);

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'meeting_request_created', 'meeting_request_accepted', 'meeting_request_declined',
    'meeting_alternative_proposed', 'meeting_request_cancelled', 'meeting_details_updated',
    'mentor_inquiry_created', 'mentor_inquiry_responded', 'mentor_inquiry_closed',
    'mentor_inquiry_cancelled', 'mentor_activity_update'
  ));
