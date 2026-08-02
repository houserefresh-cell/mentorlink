create table public.mentor_account_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'blocked')),
  reason text,
  suspended_until timestamptz,
  previous_publication_status text,
  acted_by uuid references auth.users(id) on delete set null,
  acted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_account_control_reason_valid check (
    (status = 'active' and reason is null and suspended_until is null)
    or (status = 'blocked' and char_length(btrim(reason)) between 3 and 1000 and suspended_until is null)
    or (status = 'suspended' and char_length(btrim(reason)) between 3 and 1000 and suspended_until > now())
  )
);

create table public.mentor_account_admin_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  target_email text,
  target_name text,
  action text not null check (action in ('suspended', 'blocked', 'restored', 'permanently_deleted')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  administrator_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index mentor_account_admin_events_target_idx
  on public.mentor_account_admin_events(target_user_id, created_at desc);
create index mentor_account_admin_events_created_idx
  on public.mentor_account_admin_events(created_at desc);

alter table public.mentor_account_controls enable row level security;
alter table public.mentor_account_admin_events enable row level security;
revoke all on public.mentor_account_controls, public.mentor_account_admin_events
  from public, anon, authenticated;
grant select, insert, update, delete on public.mentor_account_controls to service_role;
grant select, insert on public.mentor_account_admin_events to service_role;

-- A mentor-owned activity must not prevent an explicitly confirmed account deletion.
alter table public.mentor_activities
  drop constraint mentor_activities_mentor_user_id_fkey,
  add constraint mentor_activities_mentor_user_id_fkey
    foreign key (mentor_user_id) references auth.users(id) on delete cascade;

-- Operational messages disappear together with their activity and sender account.
alter table public.mentor_activity_updates
  drop constraint mentor_activity_updates_sender_user_id_fkey,
  add constraint mentor_activity_updates_sender_user_id_fkey
    foreign key (sender_user_id) references auth.users(id) on delete cascade;

alter table public.mentor_activity_registrations
  drop constraint mentor_activity_registrations_parent_user_id_fkey,
  add constraint mentor_activity_registrations_parent_user_id_fkey
    foreign key (parent_user_id) references auth.users(id) on delete cascade;

alter table public.mentor_activity_updates
  drop constraint mentor_activity_updates_recipient_parent_user_id_fkey,
  add constraint mentor_activity_updates_recipient_parent_user_id_fkey
    foreign key (recipient_parent_user_id) references auth.users(id) on delete cascade;

alter table public.mentor_activity_postponement_responses
  drop constraint mentor_activity_postponement_responses_parent_user_id_fkey,
  add constraint mentor_activity_postponement_responses_parent_user_id_fkey
    foreign key (parent_user_id) references auth.users(id) on delete cascade;

notify pgrst, 'reload schema';
