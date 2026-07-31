create or replace function public.stage_published_mentor_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  publication_status text;
  changed_field text;
  old_value jsonb;
  new_value jsonb;
begin
  if current_setting('mentorlink.field_review', true) = 'on' then
    return new;
  end if;

  select status
    into publication_status
    from public.mentor_publication
    where user_id = old.user_id;

  if publication_status <> 'published' then
    return new;
  end if;

  foreach changed_field in array array[
    'first_name',
    'last_name',
    'bio',
    'birth_date',
    'city',
    'phone',
    'profile_photo_path'
  ]
  loop
    old_value := to_jsonb(old) -> changed_field;
    new_value := to_jsonb(new) -> changed_field;

    if old_value is distinct from new_value then
      update public.mentor_public_pending_changes
        set requested_value = new_value,
            requested_at = now()
        where mentor_user_id = old.user_id
          and field_name = changed_field
          and status = 'pending';

      if not found then
        insert into public.mentor_public_pending_changes (
          mentor_user_id,
          field_name,
          current_value,
          requested_value
        ) values (
          old.user_id,
          changed_field,
          old_value,
          new_value
        );
      end if;

      new := jsonb_populate_record(
        new,
        jsonb_build_object(changed_field, old_value)
      );
    end if;
  end loop;

  return new;
end;
$$;

revoke all
  on function public.stage_published_mentor_profile_changes()
  from public, anon, authenticated;
create or replace function public.review_mentor_public_pending_change(
  p_change_id uuid,
  p_mentor_user_id uuid,
  p_reviewer_id uuid,
  p_action text,
  p_rejection_reason text default null
)
returns table (
  review_outcome text,
  reviewed_field text,
  approved_value jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_change public.mentor_public_pending_changes%rowtype;
  affected_rows integer;
  custom_subject_id bigint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  perform set_config('mentorlink.field_review', 'on', true);

  if p_action not in ('approve', 'reject') then
    raise exception 'invalid review action' using errcode = '22023';
  end if;

  select *
    into pending_change
    from public.mentor_public_pending_changes
    where id = p_change_id
      and mentor_user_id = p_mentor_user_id
    for update;

  if not found then
    return query select 'not_found'::text, null::text, null::jsonb;
    return;
  end if;

  if pending_change.status <> 'pending' then
    return query select 'conflict'::text, pending_change.field_name, null::jsonb;
    return;
  end if;

  if p_action = 'approve' then
    case pending_change.field_name
      when 'first_name' then
        update public.mentor_profiles
          set first_name = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      when 'last_name' then
        update public.mentor_profiles
          set last_name = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      when 'birth_date' then
        update public.mentor_profiles
          set birth_date = (pending_change.requested_value #>> '{}')::date, updated_at = now()
          where user_id = p_mentor_user_id;
      when 'bio' then
        update public.mentor_profiles
          set bio = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      when 'city' then
        update public.mentor_profiles
          set city = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      when 'phone' then
        update public.mentor_profiles
          set phone = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      when 'profile_photo_path' then
        update public.mentor_profiles
          set profile_photo_path = pending_change.requested_value #>> '{}', updated_at = now()
          where user_id = p_mentor_user_id;
      else
        if pending_change.field_name !~ '^custom_subject:[0-9]+$' then
          raise exception 'unsupported pending field' using errcode = '22023';
        end if;

        custom_subject_id := split_part(pending_change.field_name, ':', 2)::bigint;
        update public.mentor_subjects
          set custom_subject = pending_change.requested_value #>> '{}'
          where user_id = p_mentor_user_id
            and subject_id = custom_subject_id;
    end case;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'approved field target not found' using errcode = 'P0002';
    end if;

    if pending_change.field_name in ('first_name', 'last_name') then
      update auth.users
        set raw_user_meta_data = jsonb_set(
          coalesce(raw_user_meta_data, '{}'::jsonb),
          array[pending_change.field_name],
          pending_change.requested_value,
          true
        ),
        updated_at = now()
        where id = p_mentor_user_id;

      get diagnostics affected_rows = row_count;
      if affected_rows <> 1 then
        raise exception 'mentor auth identity not found' using errcode = 'P0002';
      end if;
    end if;
  end if;

  update public.mentor_public_pending_changes
    set status = case when p_action = 'approve' then 'approved' else 'rejected' end,
        reviewed_at = now(),
        reviewed_by = p_reviewer_id,
        rejection_reason = case when p_action = 'reject' then p_rejection_reason else null end
    where id = pending_change.id
      and status = 'pending';

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'pending review changed concurrently' using errcode = '40001';
  end if;

  return query select p_action, pending_change.field_name,
    case when p_action = 'approve' then pending_change.requested_value else null::jsonb end;
end;
$$;

revoke all
  on function public.review_mentor_public_pending_change(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute
  on function public.review_mentor_public_pending_change(uuid, uuid, uuid, text, text)
  to service_role;

NOTIFY pgrst, 'reload schema';