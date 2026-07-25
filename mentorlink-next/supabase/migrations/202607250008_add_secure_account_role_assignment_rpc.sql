create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

alter table public.account_roles
  drop constraint if exists account_roles_pkey;

alter table public.account_roles
  drop constraint if exists account_roles_role_allowed;

delete from public.account_roles as legacy_parent
where legacy_parent.role = 'parent'
  and exists (
    select 1
    from public.account_roles as guardian
    where guardian.user_id = legacy_parent.user_id
      and guardian.role = 'parent_guardian'
  );

update public.account_roles
set role = 'parent_guardian'
where role = 'parent';

alter table public.account_roles
  add constraint account_roles_pkey
    primary key (user_id, role);

alter table public.account_roles
  add constraint account_roles_role_allowed
    check (role in ('mentor', 'parent_guardian'));

alter table public.account_roles enable row level security;

revoke all on public.account_roles from public, anon, authenticated;
grant select on public.account_roles to authenticated;

drop policy if exists "Users can read their own account role"
on public.account_roles;

drop policy if exists "Users can read their own account roles"
on public.account_roles;

create policy "Users can read their own account roles"
on public.account_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.account_roles (user_id, role)
select
  user_id,
  case owner_type
    when 'mentor' then 'mentor'
    when 'parent_guardian' then 'parent_guardian'
  end
from public.mentor_account_ownership
where owner_type in ('mentor', 'parent_guardian')
on conflict (user_id, role) do nothing;

drop function if exists public.assign_account_role(uuid, text, text);
drop function if exists public.assign_account_role(text, text);
drop function if exists public.assign_account_role(text, boolean);

create function public.assign_account_role(
  requested_role text,
  requested_manages_mentor_profile boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid;
begin
  authenticated_user_id := (select auth.uid());

  if authenticated_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if requested_role not in ('mentor', 'parent_guardian') then
    raise exception 'Invalid account role';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(authenticated_user_id::text, 0)
  );

  insert into public.account_roles (user_id, role)
  values (authenticated_user_id, requested_role)
  on conflict (user_id, role) do nothing;

  if requested_manages_mentor_profile then
    insert into public.mentor_account_ownership (user_id, owner_type)
    values (authenticated_user_id, requested_role)
    on conflict (user_id) do nothing;
  end if;

  return requested_role;
end;
$$;

revoke all
on function public.assign_account_role(text, boolean)
from public, anon, service_role;

grant execute
on function public.assign_account_role(text, boolean)
to authenticated;

NOTIFY pgrst, 'reload schema';
