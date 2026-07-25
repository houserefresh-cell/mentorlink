create table public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),

  constraint account_roles_role_allowed
    check (role in ('mentor', 'parent'))
);

alter table public.account_roles enable row level security;

revoke all on public.account_roles from public, anon, authenticated;

grant select on public.account_roles to authenticated;

create policy "Users can read their own account role"
on public.account_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.account_roles (user_id, role)
select user_id, 'mentor'
from public.mentor_account_ownership
on conflict (user_id) do nothing;

create or replace function public.assign_account_role(
  requested_user_id uuid,
  requested_role text,
  requested_owner_type text default 'mentor'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_role text;
begin
  if requested_role not in ('mentor', 'parent') then
    raise exception 'Invalid account role';
  end if;

  if requested_owner_type not in ('mentor', 'parent_guardian') then
    raise exception 'Invalid mentor account owner type';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(requested_user_id::text, 0)
  );

  select role
  into existing_role
  from public.account_roles
  where user_id = requested_user_id
  for update;

  if existing_role is not null and existing_role <> requested_role then
    raise exception 'The account already has a different role';
  end if;

  if requested_role = 'parent' and (
    exists (
      select 1
      from public.mentor_account_ownership
      where user_id = requested_user_id
    )
    or exists (
      select 1
      from public.mentor_profiles
      where user_id = requested_user_id
    )
  ) then
    raise exception 'A mentor account cannot be changed to a parent account';
  end if;

  insert into public.account_roles (user_id, role)
  values (requested_user_id, requested_role)
  on conflict (user_id) do nothing;

  if requested_role = 'mentor' then
    insert into public.mentor_account_ownership (user_id, owner_type)
    values (requested_user_id, requested_owner_type)
    on conflict (user_id) do nothing;
  end if;

  return requested_role;
end;
$$;

revoke all
on function public.assign_account_role(uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.assign_account_role(uuid, text, text)
to service_role;

NOTIFY pgrst, 'reload schema';
