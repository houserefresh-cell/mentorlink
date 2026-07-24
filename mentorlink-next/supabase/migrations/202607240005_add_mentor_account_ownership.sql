grant usage on schema public to authenticated;

alter table public.mentor_parent_consents
  alter column parent_email drop not null;

create table public.mentor_account_ownership (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_type text not null,
  created_at timestamptz not null default now(),

  constraint mentor_account_ownership_type_allowed
    check (owner_type in ('mentor', 'parent_guardian'))
);

alter table public.mentor_account_ownership enable row level security;

revoke all on public.mentor_account_ownership from anon;
revoke all on public.mentor_account_ownership from authenticated;

grant select, insert
on public.mentor_account_ownership
to authenticated;

create policy "Users can read their own account ownership"
on public.mentor_account_ownership
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own account ownership once"
on public.mentor_account_ownership
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and owner_type in ('mentor', 'parent_guardian')
);

create or replace function public.normalize_israeli_phone(phone_number text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  compact_phone text;
begin
  if phone_number is null or trim(phone_number) = '' then
    return null;
  end if;

  compact_phone := regexp_replace(phone_number, '[^0-9+]', '', 'g');

  if compact_phone ~ '^05[0-9]{8}$' then
    return '+972' || substring(compact_phone from 2);
  end if;

  if compact_phone ~ '^9725[0-9]{8}$' then
    return '+' || compact_phone;
  end if;

  if compact_phone ~ '^\+9725[0-9]{8}$' then
    return compact_phone;
  end if;

  return compact_phone;
end;
$$;

revoke all
on function public.normalize_israeli_phone(text)
from public, anon, authenticated;

create or replace function public.validate_parent_contact_is_independent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_email text;
  authenticated_phone text;
  profile_phone text;
  mentor_birth_date date;
  account_owner_type text;
  is_parent_managed_minor boolean;
begin
  authenticated_email :=
    lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));

  authenticated_phone :=
    public.normalize_israeli_phone((select auth.jwt()) ->> 'phone');

  select phone, birth_date
  into profile_phone, mentor_birth_date
  from public.mentor_profiles
  where user_id = new.user_id;

  profile_phone := public.normalize_israeli_phone(profile_phone);

  select owner_type
  into account_owner_type
  from public.mentor_account_ownership
  where user_id = new.user_id;

  is_parent_managed_minor :=
    account_owner_type = 'parent_guardian'
    and mentor_birth_date is not null
    and mentor_birth_date > (current_date - interval '18 years')::date;

  if new.parent_email is not null and trim(new.parent_email) <> '' then
    new.parent_email := lower(trim(new.parent_email));
  else
    new.parent_email := null;
  end if;

  new.parent_phone := public.normalize_israeli_phone(new.parent_phone);

  if new.parent_phone is null
     or new.parent_phone !~ '^\+9725[0-9]{8}$' then
    raise exception 'Parent phone number must be a valid Israeli mobile number';
  end if;

  if new.parent_email is not null
     and authenticated_email <> ''
     and new.parent_email = authenticated_email
     and not is_parent_managed_minor then
    raise exception 'Parent email must be different from mentor email';
  end if;

  if authenticated_phone is not null
     and new.parent_phone = authenticated_phone then
    raise exception 'Parent phone must be different from mentor phone';
  end if;

  if profile_phone is not null
     and new.parent_phone = profile_phone then
    raise exception 'Parent phone must be different from mentor profile phone';
  end if;

  return new;
end;
$$;

revoke all
on function public.validate_parent_contact_is_independent()
from public, anon, authenticated;

drop trigger if exists validate_parent_contact_is_independent
on public.mentor_parent_consents;

create trigger validate_parent_contact_is_independent
before insert or update
on public.mentor_parent_consents
for each row
execute function public.validate_parent_contact_is_independent();

NOTIFY pgrst, 'reload schema';
