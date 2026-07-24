create table public.mentor_parent_consent_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  parent_email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint mentor_parent_consent_requests_hash_not_empty
    check (length(trim(token_hash)) = 64),
  constraint mentor_parent_consent_requests_expiry_after_creation
    check (expires_at > created_at)
);

create index mentor_parent_consent_requests_mentor_created_idx
on public.mentor_parent_consent_requests (mentor_user_id, created_at desc);

alter table public.mentor_parent_consent_requests enable row level security;

revoke all
on public.mentor_parent_consent_requests
from public, anon, authenticated;

create or replace function public.begin_parent_consent_email_request(
  requested_mentor_user_id uuid,
  requested_token_hash text,
  requested_expires_at timestamptz
)
returns table (
  request_id uuid,
  parent_email text,
  parent_name text,
  parent_relationship text,
  mentor_name text,
  consent_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentor_profile public.mentor_profiles%rowtype;
  parent_consent public.mentor_parent_consents%rowtype;
  new_request_id uuid;
begin
  select *
  into mentor_profile
  from public.mentor_profiles
  where user_id = requested_mentor_user_id;

  if mentor_profile.user_id is null or mentor_profile.birth_date is null then
    raise exception 'A valid mentor birth date is required';
  end if;

  if mentor_profile.birth_date <= (current_date - interval '18 years')::date then
    raise exception 'Parent consent is only required for a minor mentor';
  end if;

  select *
  into parent_consent
  from public.mentor_parent_consents
  where user_id = requested_mentor_user_id
  for update;

  if parent_consent.user_id is null
     or nullif(trim(parent_consent.parent_name), '') is null
     or nullif(trim(parent_consent.parent_relationship), '') is null
     or nullif(trim(parent_consent.parent_phone), '') is null
     or nullif(trim(parent_consent.parent_email), '') is null then
    raise exception 'Complete parent details are required';
  end if;

  if parent_consent.status not in ('missing', 'expired', 'declined') then
    raise exception 'A parent consent request cannot be sent in the current status';
  end if;

  if exists (
    select 1
    from public.mentor_parent_consent_requests
    where mentor_user_id = requested_mentor_user_id
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Please wait one minute before sending another request';
  end if;

  if (
    select count(*)
    from public.mentor_parent_consent_requests
    where mentor_user_id = requested_mentor_user_id
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'No more than five parent consent requests are allowed per hour';
  end if;

  if (
    select count(*)
    from public.mentor_parent_consent_requests
    where mentor_user_id = requested_mentor_user_id
      and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'No more than ten parent consent requests are allowed per 24 hours';
  end if;

  if requested_expires_at > now() + interval '48 hours 1 minute'
     or requested_expires_at < now() + interval '47 hours 59 minutes' then
    raise exception 'Parent consent links must expire after 48 hours';
  end if;

  update public.mentor_parent_consent_requests
  set revoked_at = now()
  where mentor_user_id = requested_mentor_user_id
    and used_at is null
    and revoked_at is null;

  insert into public.mentor_parent_consent_requests (
    mentor_user_id,
    token_hash,
    parent_email,
    expires_at
  )
  values (
    requested_mentor_user_id,
    lower(requested_token_hash),
    lower(trim(parent_consent.parent_email)),
    requested_expires_at
  )
  returning id into new_request_id;

  return query
  select
    new_request_id,
    lower(trim(parent_consent.parent_email)),
    parent_consent.parent_name,
    parent_consent.parent_relationship,
    trim(concat_ws(' ', mentor_profile.first_name, mentor_profile.last_name)),
    parent_consent.consent_version;
end;
$$;

create or replace function public.complete_parent_consent_email_delivery(
  requested_mentor_user_id uuid,
  requested_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivered_parent_email text;
begin
  select parent_email
  into delivered_parent_email
    from public.mentor_parent_consent_requests
    where id = requested_request_id
      and mentor_user_id = requested_mentor_user_id
      and used_at is null
      and revoked_at is null
      and expires_at > now()
    for update;

  if delivered_parent_email is null then
    raise exception 'The parent consent request is no longer active';
  end if;

  update public.mentor_parent_consents
  set
    status = 'sent',
    details_confirmed = false,
    participation_confirmed = false,
    contact_confirmed = false,
    consent_requested_at = now(),
    consented_at = null,
    declined_at = null,
    updated_at = now()
  where user_id = requested_mentor_user_id
    and status in ('missing', 'expired', 'declined')
    and lower(trim(parent_email)) = lower(trim(delivered_parent_email));

  if not found then
    raise exception 'Parent consent details changed or the status is no longer eligible';
  end if;
end;
$$;

create or replace function public.revoke_parent_consent_email_request(
  requested_mentor_user_id uuid,
  requested_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mentor_parent_consent_requests
  set revoked_at = coalesce(revoked_at, now())
  where id = requested_request_id
    and mentor_user_id = requested_mentor_user_id
    and used_at is null;
end;
$$;

create or replace function public.get_parent_consent_email_request(
  requested_token_hash text
)
returns table (
  request_state text,
  mentor_name text,
  parent_name text,
  parent_relationship text,
  consent_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent_request public.mentor_parent_consent_requests%rowtype;
begin
  select *
  into consent_request
  from public.mentor_parent_consent_requests
  where token_hash = lower(requested_token_hash)
  for update;

  if consent_request.id is null then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text;
    return;
  end if;

  if consent_request.used_at is not null then
    return query select 'used'::text, null::text, null::text, null::text, null::text;
    return;
  end if;

  if consent_request.revoked_at is not null then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text;
    return;
  end if;

  if consent_request.expires_at <= now() then
    update public.mentor_parent_consent_requests
    set revoked_at = now()
    where id = consent_request.id;

    update public.mentor_parent_consents
    set status = 'expired', updated_at = now()
    where user_id = consent_request.mentor_user_id
      and status = 'sent';

    return query select 'expired'::text, null::text, null::text, null::text, null::text;
    return;
  end if;

  if not exists (
    select 1
    from public.mentor_parent_consents
    where user_id = consent_request.mentor_user_id
      and status = 'sent'
      and lower(trim(parent_email)) = lower(trim(consent_request.parent_email))
  ) then
    return query select 'invalid'::text, null::text, null::text, null::text, null::text;
    return;
  end if;

  return query
  select
    'open'::text,
    trim(concat_ws(' ', profile.first_name, profile.last_name)),
    consent.parent_name,
    consent.parent_relationship,
    consent.consent_version
  from public.mentor_profiles as profile
  join public.mentor_parent_consents as consent
    on consent.user_id = profile.user_id
  where profile.user_id = consent_request.mentor_user_id;
end;
$$;

create or replace function public.respond_to_parent_consent_email_request(
  requested_token_hash text,
  requested_decision text,
  confirmed_details boolean,
  confirmed_participation boolean,
  confirmed_contact boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent_request public.mentor_parent_consent_requests%rowtype;
  parent_consent public.mentor_parent_consents%rowtype;
begin
  if requested_decision not in ('approved', 'declined') then
    raise exception 'Invalid parent consent decision';
  end if;

  select *
  into consent_request
  from public.mentor_parent_consent_requests
  where token_hash = lower(requested_token_hash)
  for update;

  if consent_request.id is null
     or consent_request.used_at is not null
     or consent_request.revoked_at is not null then
    return 'used_or_invalid';
  end if;

  if consent_request.expires_at <= now() then
    update public.mentor_parent_consent_requests
    set revoked_at = now()
    where id = consent_request.id;

    update public.mentor_parent_consents
    set status = 'expired', updated_at = now()
    where user_id = consent_request.mentor_user_id
      and status = 'sent';

    return 'expired';
  end if;

  select *
  into parent_consent
  from public.mentor_parent_consents
  where user_id = consent_request.mentor_user_id
  for update;

  if parent_consent.user_id is null
     or parent_consent.status <> 'sent'
     or lower(trim(parent_consent.parent_email))
        is distinct from lower(trim(consent_request.parent_email)) then
    return 'used_or_invalid';
  end if;

  if requested_decision = 'approved'
     and not (
       confirmed_details
       and confirmed_participation
       and confirmed_contact
     ) then
    raise exception 'All consent confirmations are required for approval';
  end if;

  if requested_decision = 'approved' then
    update public.mentor_parent_consents
    set
      status = 'approved',
      details_confirmed = true,
      participation_confirmed = true,
      contact_confirmed = true,
      consented_at = now(),
      declined_at = null,
      updated_at = now()
    where user_id = consent_request.mentor_user_id;
  else
    update public.mentor_parent_consents
    set
      status = 'declined',
      details_confirmed = false,
      participation_confirmed = false,
      contact_confirmed = false,
      consented_at = null,
      declined_at = now(),
      updated_at = now()
    where user_id = consent_request.mentor_user_id;
  end if;

  if not found then
    raise exception 'Parent consent record was not found';
  end if;

  update public.mentor_parent_consent_requests
  set used_at = now()
  where id = consent_request.id;

  return requested_decision;
end;
$$;

revoke all
on function public.begin_parent_consent_email_request(uuid, text, timestamptz)
from public, anon, authenticated;

revoke all
on function public.complete_parent_consent_email_delivery(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.revoke_parent_consent_email_request(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.get_parent_consent_email_request(text)
from public, anon, authenticated;

revoke all
on function public.respond_to_parent_consent_email_request(text, text, boolean, boolean, boolean)
from public, anon, authenticated;

grant execute
on function public.begin_parent_consent_email_request(uuid, text, timestamptz)
to service_role;

grant execute
on function public.complete_parent_consent_email_delivery(uuid, uuid)
to service_role;

grant execute
on function public.revoke_parent_consent_email_request(uuid, uuid)
to service_role;

grant execute
on function public.get_parent_consent_email_request(text)
to service_role;

grant execute
on function public.respond_to_parent_consent_email_request(text, text, boolean, boolean, boolean)
to service_role;

NOTIFY pgrst, 'reload schema';
