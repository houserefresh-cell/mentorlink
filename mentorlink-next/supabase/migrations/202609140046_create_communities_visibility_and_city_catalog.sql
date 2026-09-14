create table if not exists public.israel_localities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  normalized_name text not null unique,
  city_code text,
  region text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.israel_localities(id) on delete restrict,
  name text not null,
  description text,
  is_public boolean not null default true,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  is_pilot boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (locality_id, name)
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'suspended', 'archived')),
  joined_via text not null default 'request' check (joined_via in ('request', 'invite', 'admin_manual')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.community_managers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('manager', 'coordinator')),
  added_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid references auth.users(id),
  invite_type text not null default 'link' check (invite_type in ('link', 'email', 'sms')),
  token_hash text not null,
  email_target text,
  phone_target text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentor_visibility_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  general_scope text not null default 'public' check (general_scope in ('public', 'community_restricted')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_visibility_communities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, community_id)
);

create table if not exists public.parent_visibility_approvals (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  parent_user_id uuid references auth.users(id),
  approved_scope text not null default 'public' check (approved_scope in ('public', 'community_restricted')),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (mentor_user_id, parent_user_id)
);

alter table public.israel_localities enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_managers enable row level security;
alter table public.community_invitations enable row level security;
alter table public.mentor_visibility_settings enable row level security;
alter table public.mentor_visibility_communities enable row level security;
alter table public.parent_visibility_approvals enable row level security;

revoke all on public.israel_localities from anon, public;
revoke all on public.communities from anon, public;
revoke all on public.community_memberships from anon, public;
revoke all on public.community_managers from anon, public;
revoke all on public.community_invitations from anon, public;
revoke all on public.mentor_visibility_settings from anon, public;
revoke all on public.mentor_visibility_communities from anon, public;
revoke all on public.parent_visibility_approvals from anon, public;

grant select on public.israel_localities to authenticated;
grant select on public.communities to authenticated;
grant select on public.community_memberships to authenticated;
grant select on public.community_managers to authenticated;
grant select on public.community_invitations to authenticated;
grant select on public.mentor_visibility_settings to authenticated;
grant select on public.mentor_visibility_communities to authenticated;
grant select on public.parent_visibility_approvals to authenticated;

create policy "Authenticated users can read Israel localities"
on public.israel_localities
for select to authenticated
using (is_active = true);

create policy "Authenticated users can read active communities"
on public.communities
for select to authenticated
using (status = 'active');

create policy "Users can read their own community memberships"
on public.community_memberships
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their own visibility settings"
on public.mentor_visibility_settings
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their own visibility communities"
on public.mentor_visibility_communities
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their own parent visibility approvals"
on public.parent_visibility_approvals
for select to authenticated
using ((select auth.uid()) = mentor_user_id or (select auth.uid()) = parent_user_id);

-- Community membership changes, invitations, manager assignments, mentor visibility
-- changes and parent-approval changes are performed only by trusted server routes
-- using the service role. No authenticated client receives direct INSERT/UPDATE/DELETE
-- policies for these tables. In particular, a user cannot promote a pending private
-- membership to active by writing directly to community_memberships.

NOTIFY pgrst, 'reload schema';
