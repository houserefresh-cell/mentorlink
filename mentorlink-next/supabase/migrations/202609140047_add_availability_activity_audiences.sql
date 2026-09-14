-- Additive audience/location support for mentor availability and activities.
-- Legacy rows remain public and valid.

alter table public.mentor_availability_windows
  add column if not exists location text,
  add column if not exists audience_scope text not null default 'all',
  add column if not exists community_ids uuid[] not null default '{}'::uuid[];

alter table public.mentor_availability_windows
  drop constraint if exists mentor_availability_windows_audience_scope_check;
alter table public.mentor_availability_windows
  add constraint mentor_availability_windows_audience_scope_check
  check (audience_scope in ('all', 'community'));

alter table public.mentor_availability_windows
  drop constraint if exists mentor_availability_windows_community_audience_check;
alter table public.mentor_availability_windows
  add constraint mentor_availability_windows_community_audience_check
  check (audience_scope = 'all' or cardinality(community_ids) > 0);

alter table public.meeting_requests
  add column if not exists source_availability_id uuid
  references public.mentor_availability_windows(id) on delete set null;

create index if not exists meeting_requests_source_availability_idx
  on public.meeting_requests (source_availability_id, requested_start_at desc)
  where source_availability_id is not null;

alter table public.mentor_activities
  add column if not exists audience_scope text not null default 'all',
  add column if not exists community_ids uuid[] not null default '{}'::uuid[];

alter table public.mentor_activities
  drop constraint if exists mentor_activities_audience_scope_check;
alter table public.mentor_activities
  add constraint mentor_activities_audience_scope_check
  check (audience_scope in ('all', 'community'));

alter table public.mentor_activities
  drop constraint if exists mentor_activities_community_audience_check;
alter table public.mentor_activities
  add constraint mentor_activities_community_audience_check
  check (audience_scope = 'all' or cardinality(community_ids) > 0);

create index if not exists mentor_activities_audience_idx
  on public.mentor_activities (audience_scope, status);

NOTIFY pgrst, 'reload schema';
