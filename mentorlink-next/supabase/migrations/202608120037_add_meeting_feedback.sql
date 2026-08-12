create table if not exists public.mentor_meeting_feedback (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null unique references public.meeting_requests(id) on delete restrict,
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  attendance text not null check (attendance in ('attended', 'partially_attended', 'did_not_attend', 'activity_did_not_happen')),
  professionalism smallint not null check (professionalism between 1 and 5),
  patience_listening smallint not null check (patience_listening between 1 and 5),
  clarity smallint not null check (clarity between 1 and 5),
  age_level_fit smallint not null check (age_level_fit between 1 and 5),
  child_enjoyment smallint not null check (child_enjoyment between 1 and 5),
  expectations smallint not null check (expectations between 1 and 5),
  recommendation smallint not null check (recommendation between 1 and 5),
  punctuality text not null check (punctuality in ('on_time', 'slightly_late_notified', 'late_without_notice', 'activity_did_not_happen')),
  worked_well text check (worked_well is null or char_length(btrim(worked_well)) <= 1500),
  could_improve text check (could_improve is null or char_length(btrim(could_improve)) <= 1500),
  felt_uncomfortable boolean not null default false,
  safety_incident boolean not null default false,
  requests_admin_contact boolean not null default false,
  private_safety_details text check (private_safety_details is null or char_length(btrim(private_safety_details)) <= 2500),
  allow_public_quote boolean not null default false,
  publication_status text not null default 'not_requested' check (publication_status in ('not_requested', 'pending', 'approved', 'rejected')),
  admin_handling_status text not null default 'new' check (admin_handling_status in ('new', 'reviewing', 'resolved')),
  admin_notes text check (admin_notes is null or char_length(btrim(admin_notes)) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists meeting_feedback_parent_idx on public.mentor_meeting_feedback(parent_user_id, submitted_at desc);
create index if not exists meeting_feedback_mentor_idx on public.mentor_meeting_feedback(mentor_user_id, submitted_at desc);
create index if not exists meeting_feedback_admin_idx on public.mentor_meeting_feedback(admin_handling_status, submitted_at desc);

alter table public.mentor_meeting_feedback enable row level security;
revoke all on public.mentor_meeting_feedback from public, anon, authenticated;
grant select, insert, update on public.mentor_meeting_feedback to service_role;

notify pgrst, 'reload schema';
