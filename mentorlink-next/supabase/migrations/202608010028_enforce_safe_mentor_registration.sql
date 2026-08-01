create or replace function public.enforce_minor_parent_consent_before_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentor_birth_date date;
  parent_consent_status text;
  mentor_email_confirmed_at timestamptz;
begin
  if new.status = 'pending_review' then
    select birth_date into mentor_birth_date
    from public.mentor_profiles where user_id = new.user_id;

    if mentor_birth_date is null then
      raise exception 'A valid birth date is required before submitting the mentor profile';
    end if;

    if mentor_birth_date > (current_date - interval '10 years')::date then
      raise exception 'Mentor registration is allowed from age 10';
    end if;

    select email_confirmed_at into mentor_email_confirmed_at
    from auth.users where id = new.user_id;
    if mentor_email_confirmed_at is null then
      raise exception 'A confirmed email is required before submitting the mentor profile';
    end if;

    if mentor_birth_date > (current_date - interval '18 years')::date then
      select status into parent_consent_status
      from public.mentor_parent_consents where user_id = new.user_id;
      if parent_consent_status is distinct from 'approved' then
        raise exception 'Approved parent consent is required before submitting a minor mentor profile';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_minor_parent_consent_before_review() from public, anon, authenticated;
grant execute on function public.enforce_minor_parent_consent_before_review() to service_role;

NOTIFY pgrst, 'reload schema';
