-- Keep activity and registration state consistent and notify every affected side.
drop trigger if exists mentor_activity_registration_notification on public.mentor_activity_registrations;
create trigger mentor_activity_registration_notification
after insert or update of status on public.mentor_activity_registrations
for each row execute function public.notify_mentor_activity_registration();

create or replace function public.notify_mentor_activity_registration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
begin
  select * into v_activity from public.mentor_activities where id = new.activity_id;
  if not found then return new; end if;

  if new.status in ('registered', 'waitlisted')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      case when new.status = 'registered' then 'הרשמה חדשה לפעילות' else 'הצטרפות לרשימת ההמתנה' end,
      format('%s %s לפעילות %s.', new.child_first_name, case when new.status = 'registered' then 'נרשמ/ה' else 'הצטרפ/ה לרשימת ההמתנה' end, coalesce(v_activity.title, 'שלך')),
      '/dashboard/mentor/activity-registrations'
    );
  elsif tg_op = 'UPDATE' and old.status in ('registered', 'waitlisted') and new.status = 'cancelled'
        and v_activity.status <> 'cancelled' then
    insert into public.notifications(user_id, kind, title, body, href)
    values (v_activity.mentor_user_id, 'mentor_activity_update', 'ביטול השתתפות בפעילות',
      format('ההרשמה של %s לפעילות %s בוטלה.', new.child_first_name, coalesce(v_activity.title, 'שלך')),
      '/dashboard/mentor/activity-registrations');
  end if;
  return new;
end;
$$;

create or replace function public.cancel_mentor_activity_with_update(
  p_activity_id uuid, p_mentor_user_id uuid, p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_update_id uuid;
  v_starts_at timestamptz;
  v_has_active boolean;
  v_parent uuid;
  v_title text;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'CANCELLATION_REASON_REQUIRED' using errcode = '22023';
  end if;
  select a.title, min(s.starts_at) filter (where s.ends_at >= now())
    into v_title, v_starts_at
  from public.mentor_activities a
  left join public.mentor_activity_sessions s on s.activity_id = a.id
  where a.id = p_activity_id and a.mentor_user_id = p_mentor_user_id and a.status = 'published'
  group by a.title;
  if not found then raise exception 'ACTIVITY_NOT_OWNED_OR_CANCELLABLE' using errcode = '42501'; end if;

  select exists(select 1 from public.mentor_activity_registrations where activity_id = p_activity_id and status in ('registered','waitlisted')) into v_has_active;
  if v_has_active and v_starts_at is not null and v_starts_at <= now() + interval '24 hours' then
    raise exception 'ACTIVITY_CANCELLATION_WITHIN_24_HOURS' using errcode = 'P0001';
  end if;

  if v_has_active then
    v_update_id := public.create_mentor_activity_update(p_activity_id, p_mentor_user_id,
      'all_active', null, 'cancellation', btrim(p_reason), null, null, null);
    for v_parent in select distinct parent_user_id from public.mentor_activity_registrations where activity_id = p_activity_id and status in ('registered','waitlisted') loop
      insert into public.notifications(user_id, kind, title, body, href)
      values (v_parent, 'mentor_activity_update', 'הפעילות בוטלה', format('%s בוטלה. סיבת הביטול: %s', coalesce(v_title, 'הפעילות'), btrim(p_reason)), '/dashboard/parent/activities');
    end loop;
  end if;

  update public.mentor_activities set status = 'cancelled', cancelled_at = now(), completed_at = null, updated_at = now()
  where id = p_activity_id and mentor_user_id = p_mentor_user_id and status = 'published';
  update public.mentor_activity_registrations set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where activity_id = p_activity_id and status in ('registered','waitlisted');
  return v_update_id;
end;
$$;

revoke all on function public.cancel_mentor_activity_with_update(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_mentor_activity_with_update(uuid, uuid, text) to service_role;
notify pgrst, 'reload schema';
