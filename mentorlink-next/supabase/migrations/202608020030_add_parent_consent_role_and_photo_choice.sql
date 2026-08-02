alter table public.mentor_parent_consents
  add column if not exists platform_role_confirmed boolean not null default false,
  add column if not exists profile_photo_visibility text not null default 'hidden',
  add column if not exists profile_photo_consented_at timestamptz;

alter table public.mentor_parent_consents
  drop constraint if exists mentor_parent_consents_profile_photo_visibility_allowed;

alter table public.mentor_parent_consents
  add constraint mentor_parent_consents_profile_photo_visibility_allowed
  check (profile_photo_visibility in ('hidden', 'public'));

update public.mentor_parent_consent_requests as request
set revoked_at = now()
from public.mentor_parent_consents as consent
where request.mentor_user_id = consent.user_id
  and consent.status = 'sent'
  and consent.consent_version <> 'mentor-parent-consent-v2'
  and request.used_at is null
  and request.revoked_at is null;

update public.mentor_parent_consents
set status = 'expired', updated_at = now()
where status = 'sent'
  and consent_version <> 'mentor-parent-consent-v2';

create or replace function public.respond_to_parent_consent_email_request(
  requested_token_hash text,
  requested_decision text,
  confirmed_details boolean,
  confirmed_participation boolean,
  confirmed_contact boolean,
  confirmed_platform_role boolean,
  confirmed_public_photo boolean
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

  select * into consent_request
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
    where user_id = consent_request.mentor_user_id and status = 'sent';
    return 'expired';
  end if;

  select * into parent_consent
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
       and confirmed_platform_role
     ) then
    raise exception 'All required consent confirmations are required for approval';
  end if;

  if requested_decision = 'approved' then
    update public.mentor_parent_consents
    set
      status = 'approved',
      details_confirmed = true,
      participation_confirmed = true,
      contact_confirmed = true,
      platform_role_confirmed = true,
      profile_photo_visibility = case when confirmed_public_photo then 'public' else 'hidden' end,
      profile_photo_consented_at = case when confirmed_public_photo then now() else null end,
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
      platform_role_confirmed = false,
      profile_photo_visibility = 'hidden',
      profile_photo_consented_at = null,
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
on function public.respond_to_parent_consent_email_request(text, text, boolean, boolean, boolean, boolean, boolean)
from public, anon, authenticated;

grant execute
on function public.respond_to_parent_consent_email_request(text, text, boolean, boolean, boolean, boolean, boolean)
to service_role;

drop function if exists public.respond_to_parent_consent_email_request(text, text, boolean, boolean, boolean);

notify pgrst, 'reload schema';
