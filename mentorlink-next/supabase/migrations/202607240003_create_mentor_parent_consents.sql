grant usage on schema public to authenticated;

create table public.mentor_parent_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  parent_name text not null,
  parent_relationship text not null,
  parent_phone text not null,
  parent_email text not null,
  details_confirmed boolean not null default false,
  participation_confirmed boolean not null default false,
  contact_confirmed boolean not null default false,
  status text not null default 'missing',
  consent_version text not null,
  consent_requested_at timestamptz,
  consented_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mentor_parent_consents_relationship_allowed
    check (
      parent_relationship in (
        'אמא',
        'אבא',
        'אפוטרופוס/ית',
        'אחר'
      )
    ),

  constraint mentor_parent_consents_status_allowed
    check (
      status in (
        'not_required',
        'missing',
        'sent',
        'approved',
        'declined',
        'expired'
      )
    )
);

alter table public.mentor_parent_consents enable row level security;

revoke all on public.mentor_parent_consents from anon;
revoke all on public.mentor_parent_consents from authenticated;

grant select, insert, update
on public.mentor_parent_consents
to authenticated;

create policy "Mentors can read their own parent consent"
on public.mentor_parent_consents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Mentors can create their own parent consent"
on public.mentor_parent_consents
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status in ('missing', 'sent')
);

create policy "Mentors can update pending parent consent details"
on public.mentor_parent_consents
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status in ('missing', 'sent')
)
with check (
  (select auth.uid()) = user_id
  and status in ('missing', 'sent')
);

create function public.enforce_minor_parent_consent_before_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mentor_birth_date date;
  parent_consent_status text;
begin
  if new.status = 'pending_review' then
    select birth_date
    into mentor_birth_date
    from public.mentor_profiles
    where user_id = new.user_id;

    if mentor_birth_date is null then
      raise exception
        'A valid birth date is required before submitting the mentor profile';
    end if;

    if mentor_birth_date > (current_date - interval '18 years')::date then
      select status
      into parent_consent_status
      from public.mentor_parent_consents
      where user_id = new.user_id;

      if parent_consent_status is distinct from 'approved' then
        raise exception
          'Approved parent consent is required before submitting a minor mentor profile';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function public.enforce_minor_parent_consent_before_review()
from public, anon, authenticated;

create trigger enforce_minor_parent_consent_before_review
before insert or update of status
on public.mentor_publication
for each row
execute function public.enforce_minor_parent_consent_before_review();

NOTIFY pgrst, 'reload schema';
