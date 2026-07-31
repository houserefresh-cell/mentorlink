do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.mentor_public_pending_changes'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%field_name%'
      and pg_get_constraintdef(c.oid) like '%custom_subject%'
  loop
    execute format(
      'alter table public.mentor_public_pending_changes drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.mentor_public_pending_changes
  add constraint mentor_public_pending_changes_field_name_check check (
    field_name in (
      'first_name',
      'last_name',
      'bio',
      'birth_date',
      'city',
      'phone',
      'profile_photo_path'
    )
    or field_name ~ '^custom_subject:[0-9]+$'
  );

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
  if (select auth.role()) = 'service_role' then
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
        )
        values (
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

NOTIFY pgrst, 'reload schema';