create table public.parent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  phone text not null check (char_length(regexp_replace(phone, '[^0-9+]', '', 'g')) between 9 and 15),
  city text check (city is null or char_length(btrim(city)) between 2 and 80),
  street text check (street is null or char_length(btrim(street)) between 2 and 120),
  wants_home_mentoring boolean not null default false,
  house_number text check (house_number is null or char_length(btrim(house_number)) between 1 and 20),
  entrance text check (entrance is null or char_length(btrim(entrance)) between 1 and 20),
  apartment text check (apartment is null or char_length(btrim(apartment)) between 1 and 20),
  address_notes text check (address_notes is null or char_length(btrim(address_notes)) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parent_children
  add column last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 60);

create table public.mentor_activity_feedback (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.mentor_activity_registrations(id) on delete restrict,
  activity_id uuid not null references public.mentor_activities(id) on delete restrict,
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  child_id uuid not null references public.parent_children(id) on delete restrict,
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

create index parent_profiles_phone_idx on public.parent_profiles(phone);
create index activity_feedback_parent_idx on public.mentor_activity_feedback(parent_user_id, submitted_at desc);
create index activity_feedback_mentor_idx on public.mentor_activity_feedback(mentor_user_id, submitted_at desc);
create index activity_feedback_admin_idx on public.mentor_activity_feedback(admin_handling_status, submitted_at desc);

alter table public.parent_profiles enable row level security;
alter table public.mentor_activity_feedback enable row level security;
revoke all on public.parent_profiles, public.mentor_activity_feedback from public, anon, authenticated;
grant select, insert, update on public.parent_profiles to service_role;
grant select, insert, update on public.mentor_activity_feedback to service_role;

create or replace function public.save_parent_profile(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_city text,
  p_street text,
  p_wants_home_mentoring boolean,
  p_house_number text,
  p_entrance text,
  p_apartment text,
  p_address_notes text
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.parent_profiles(
    user_id, first_name, last_name, phone, city, street, wants_home_mentoring,
    house_number, entrance, apartment, address_notes
  ) values (
    p_user_id, btrim(p_first_name), btrim(p_last_name), btrim(p_phone),
    nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_street, '')), ''),
    coalesce(p_wants_home_mentoring, false),
    case when p_wants_home_mentoring then nullif(btrim(coalesce(p_house_number, '')), '') end,
    case when p_wants_home_mentoring then nullif(btrim(coalesce(p_entrance, '')), '') end,
    case when p_wants_home_mentoring then nullif(btrim(coalesce(p_apartment, '')), '') end,
    case when p_wants_home_mentoring then nullif(btrim(coalesce(p_address_notes, '')), '') end
  ) on conflict (user_id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone,
    city = excluded.city, street = excluded.street, wants_home_mentoring = excluded.wants_home_mentoring,
    house_number = excluded.house_number, entrance = excluded.entrance, apartment = excluded.apartment,
    address_notes = excluded.address_notes, updated_at = now();
end;
$$;

revoke all on function public.save_parent_profile(uuid, text, text, text, text, text, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_parent_profile(uuid, text, text, text, text, text, boolean, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
