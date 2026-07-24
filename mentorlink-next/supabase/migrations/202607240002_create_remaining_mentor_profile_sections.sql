grant usage on schema public to authenticated;

create table public.mentor_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_schedule jsonb not null default '{}'::jsonb,
  flexible_availability boolean not null default false,
  available_on_holidays boolean not null default false,
  recurring_meetings boolean not null default false,
  one_time_meetings boolean not null default false,
  time_preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  city text not null,
  activity_areas text[] not null default '{}',
  preferred_schools text[] not null default '{}',
  custom_school text,
  meeting_places text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_experience (
  user_id uuid primary key references auth.users(id) on delete cascade,
  has_previous_mentoring boolean not null default false,
  previous_mentoring_details text,
  experience_types text[] not null default '{}',
  courses_and_certificates text,
  strengths text[] not null default '{}',
  relationship_values text not null,
  motivation text not null,
  mentoring_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_age_groups text[] not null default '{}',
  preferred_gender text not null,
  max_travel_distance_km integer not null,
  meeting_modes text[] not null default '{}',
  session_formats text[] not null default '{}',
  preferred_meetings_per_week integer not null,
  preferred_session_duration_minutes integer not null,
  willing_special_needs boolean not null default false,
  additional_matching_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_preferences_distance_nonnegative
    check (max_travel_distance_km >= 0),
  constraint mentor_preferences_meetings_positive
    check (preferred_meetings_per_week > 0),
  constraint mentor_preferences_duration_positive
    check (preferred_session_duration_minutes > 0)
);

create table public.mentor_publication (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_publication_status_allowed
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'paused'))
);

alter table public.mentor_profiles
  add column if not exists profile_photo_path text;

alter table public.mentor_availability enable row level security;
alter table public.mentor_locations enable row level security;
alter table public.mentor_experience enable row level security;
alter table public.mentor_preferences enable row level security;
alter table public.mentor_publication enable row level security;

revoke all on public.mentor_availability from anon;
revoke all on public.mentor_locations from anon;
revoke all on public.mentor_experience from anon;
revoke all on public.mentor_preferences from anon;
revoke all on public.mentor_publication from anon;

grant select, insert, update, delete on public.mentor_availability to authenticated;
grant select, insert, update, delete on public.mentor_locations to authenticated;
grant select, insert, update, delete on public.mentor_experience to authenticated;
grant select, insert, update, delete on public.mentor_preferences to authenticated;
grant select, insert, update on public.mentor_publication to authenticated;

create policy "Mentors manage their own availability"
on public.mentor_availability
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Mentors manage their own locations"
on public.mentor_locations
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Mentors manage their own experience"
on public.mentor_experience
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Mentors manage their own preferences"
on public.mentor_preferences
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Mentors can read their own publication"
on public.mentor_publication
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Mentors can create their own publication"
on public.mentor_publication
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_review')
);

create policy "Mentors can update their own publication"
on public.mentor_publication
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and status in ('draft', 'pending_review', 'paused')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mentor-profile-photos',
  'mentor-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Mentors read their own profile photos"
on storage.objects
for select to authenticated
using (
  bucket_id = 'mentor-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Mentors upload their own profile photos"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mentor-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Mentors update their own profile photos"
on storage.objects
for update to authenticated
using (
  bucket_id = 'mentor-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'mentor-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Mentors delete their own profile photos"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'mentor-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

NOTIFY pgrst, 'reload schema';
