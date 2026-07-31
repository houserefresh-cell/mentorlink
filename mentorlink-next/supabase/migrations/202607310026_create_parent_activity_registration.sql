create table public.parent_children (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  grade text check (grade is null or grade in (
    'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
    'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'
  )),
  birth_date date check (birth_date is null or birth_date <= current_date),
  accommodation_notes text check (
    accommodation_notes is null or char_length(btrim(accommodation_notes)) between 1 and 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_children_name_unique unique (parent_user_id, first_name)
);

alter table public.mentor_activities
  add column image_path text check (image_path is null or char_length(image_path) between 1 and 500),
  add column image_alt text check (image_alt is null or char_length(btrim(image_alt)) between 1 and 160);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('activity-images', 'activity-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.mentor_activity_registrations
  add column child_id uuid references public.parent_children(id) on delete restrict;

alter table public.mentor_activity_registrations
  drop constraint mentor_activity_registration_child_unique;

create unique index mentor_activity_registration_child_id_unique
  on public.mentor_activity_registrations(activity_id, child_id)
  where child_id is not null and status in ('registered', 'waitlisted');

create index parent_children_parent_created_idx
  on public.parent_children(parent_user_id, created_at);

create table public.mentor_activity_postponement_responses (
  update_id uuid not null references public.mentor_activity_updates(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete restrict,
  response text not null check (response in ('accepted', 'declined')),
  responded_at timestamptz not null default now(),
  primary key (update_id, parent_user_id)
);

alter table public.parent_children enable row level security;
alter table public.mentor_activity_postponement_responses enable row level security;
revoke all on public.parent_children from public, anon, authenticated;
revoke all on public.mentor_activity_postponement_responses from public, anon, authenticated;
grant select, insert, update, delete on public.parent_children to service_role;
grant select, insert, update on public.mentor_activity_postponement_responses to service_role;

create or replace function public.register_children_for_activity(
  p_activity_id uuid,
  p_parent_user_id uuid,
  p_child_ids uuid[],
  p_idempotency_keys uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
  v_child public.parent_children%rowtype;
  v_child_id uuid;
  v_key uuid;
  v_position integer;
  v_registered_count integer;
  v_status text;
  v_results jsonb := '[]'::jsonb;
begin
  if p_parent_user_id is null or coalesce(cardinality(p_child_ids), 0) = 0
    or cardinality(p_child_ids) <> cardinality(p_idempotency_keys)
    or cardinality(p_child_ids) > 10 then
    raise exception 'INVALID_ACTIVITY_REGISTRATION' using errcode = '22023';
  end if;
  if cardinality(p_child_ids) <> (select count(distinct value) from unnest(p_child_ids) as value) then
    raise exception 'DUPLICATE_CHILD_SELECTION' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_activity_id::text, 0));
  select * into v_activity from public.mentor_activities
    where id = p_activity_id and status = 'published' for update;
  if not found then raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_activity.registration_deadline is null or v_activity.registration_deadline <= now() then
    raise exception 'REGISTRATION_CLOSED' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.mentor_activity_sessions
    where activity_id = p_activity_id and starts_at > now()
  ) then raise exception 'ACTIVITY_ALREADY_STARTED' using errcode = '22023'; end if;

  for v_position in 1..cardinality(p_child_ids) loop
    v_child_id := p_child_ids[v_position];
    v_key := p_idempotency_keys[v_position];
    select * into v_child from public.parent_children
      where id = v_child_id and parent_user_id = p_parent_user_id;
    if not found then raise exception 'CHILD_NOT_OWNED' using errcode = '42501'; end if;
    if exists (
      select 1 from public.mentor_activity_registrations
      where activity_id = p_activity_id and child_id = v_child_id
        and status in ('registered', 'waitlisted')
    ) then raise exception 'CHILD_ALREADY_REGISTERED' using errcode = '23505'; end if;

    select count(*) into v_registered_count
      from public.mentor_activity_registrations
      where activity_id = p_activity_id and status = 'registered';
    v_status := case when v_registered_count < v_activity.max_participants
      then 'registered' else 'waitlisted' end;

    insert into public.mentor_activity_registrations(
      activity_id, parent_user_id, child_id, idempotency_key,
      child_first_name, child_grade_or_age, child_needs, status
    ) values (
      p_activity_id, p_parent_user_id, v_child.id, v_key,
      btrim(v_child.first_name), coalesce(v_child.grade, 'לא צוין'),
      nullif(btrim(v_child.accommodation_notes), ''), v_status
    );
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'childId', v_child.id, 'childFirstName', v_child.first_name, 'status', v_status
    ));
  end loop;
  return v_results;
end;
$$;

create or replace function public.cancel_parent_activity_registration(
  p_registration_id uuid,
  p_parent_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
  v_cancelled_status text;
  v_promoted_parent uuid;
begin
  select activity_id, status into v_activity_id, v_cancelled_status
  from public.mentor_activity_registrations
  where id = p_registration_id and parent_user_id = p_parent_user_id
    and status in ('registered', 'waitlisted') for update;
  if not found then raise exception 'REGISTRATION_NOT_CANCELLABLE' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_activity_id::text, 0));
  update public.mentor_activity_registrations
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = p_registration_id;
  if v_cancelled_status = 'registered' then
    update public.mentor_activity_registrations
      set status = 'registered', updated_at = now()
      where id = (
        select id from public.mentor_activity_registrations
        where activity_id = v_activity_id and status = 'waitlisted'
        order by created_at for update skip locked limit 1
      )
      returning parent_user_id into v_promoted_parent;
    if v_promoted_parent is not null then
      insert into public.notifications(user_id, kind, title, body, href)
      values (v_promoted_parent, 'mentor_activity_update', 'התפנה מקום בפעילות',
        'ההרשמה עברה מרשימת ההמתנה לרשימת המשתתפים.', '/dashboard/parent/activities');
    end if;
  end if;
  return v_activity_id;
end;
$$;

create or replace function public.respond_to_activity_postponement(
  p_update_id uuid,
  p_parent_user_id uuid,
  p_response text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
  v_mentor_user_id uuid;
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'INVALID_POSTPONEMENT_RESPONSE' using errcode = '22023';
  end if;
  select u.activity_id, a.mentor_user_id into v_activity_id, v_mentor_user_id
  from public.mentor_activity_updates u
  join public.mentor_activities a on a.id = u.activity_id
  where u.id = p_update_id and u.update_type = 'postponement'
    and (u.recipient_scope = 'all_active' or u.recipient_parent_user_id = p_parent_user_id)
    and exists (
      select 1 from public.mentor_activity_registrations r
      where r.activity_id = u.activity_id and r.parent_user_id = p_parent_user_id
        and r.status in ('registered', 'waitlisted')
    );
  if not found then raise exception 'POSTPONEMENT_NOT_AVAILABLE' using errcode = '42501'; end if;
  insert into public.mentor_activity_postponement_responses(update_id, parent_user_id, response)
  values (p_update_id, p_parent_user_id, p_response)
  on conflict (update_id, parent_user_id) do update
    set response = excluded.response, responded_at = now();
  insert into public.notifications(user_id, kind, title, body, href)
  values (v_mentor_user_id, 'mentor_activity_update', 'תגובה להצעת דחיית פעילות',
    case when p_response = 'accepted' then 'הורה אישר את המועד החלופי.' else 'המועד החלופי אינו מתאים להורה.' end,
    '/dashboard/mentor/activities');
  return v_activity_id;
end;
$$;

revoke all on function public.register_children_for_activity(uuid, uuid, uuid[], uuid[]),
  public.cancel_parent_activity_registration(uuid, uuid),
  public.respond_to_activity_postponement(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.register_children_for_activity(uuid, uuid, uuid[], uuid[]),
  public.cancel_parent_activity_registration(uuid, uuid),
  public.respond_to_activity_postponement(uuid, uuid, text)
to service_role;

notify pgrst, 'reload schema';
