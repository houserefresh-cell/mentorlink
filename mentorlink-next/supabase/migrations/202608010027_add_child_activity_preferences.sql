alter table public.parent_children
  drop constraint parent_children_grade_check;

alter table public.parent_children
  add constraint parent_children_grade_check check (grade is null or grade in (
    'kindergarten', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
    'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'
  )),
  add column school_name text check (
    school_name is null or char_length(btrim(school_name)) between 2 and 120
  );

create table public.parent_child_subject_interests (
  child_id uuid not null references public.parent_children(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (child_id, subject_id)
);

create index parent_child_subject_interests_subject_idx
  on public.parent_child_subject_interests(subject_id, child_id);

alter table public.parent_child_subject_interests enable row level security;
revoke all on public.parent_child_subject_interests from public, anon, authenticated;
grant select, insert, delete on public.parent_child_subject_interests to service_role;

create or replace function public.save_parent_child_preferences(
  p_parent_user_id uuid,
  p_child_id uuid,
  p_first_name text,
  p_grade text,
  p_birth_date date,
  p_school_name text,
  p_accommodation_notes text,
  p_interest_subject_ids bigint[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_child_id uuid;
  v_interest_ids bigint[] := coalesce(p_interest_subject_ids, '{}'::bigint[]);
begin
  if p_parent_user_id is null or char_length(btrim(coalesce(p_first_name, ''))) not between 1 and 60 then
    raise exception 'INVALID_CHILD_DETAILS';
  end if;

  if p_child_id is null then
    insert into public.parent_children (
      parent_user_id, first_name, grade, birth_date, school_name, accommodation_notes
    ) values (
      p_parent_user_id, btrim(p_first_name), p_grade, p_birth_date,
      nullif(btrim(coalesce(p_school_name, '')), ''),
      nullif(btrim(coalesce(p_accommodation_notes, '')), '')
    ) returning id into v_child_id;
  else
    update public.parent_children
    set first_name = btrim(p_first_name),
        grade = p_grade,
        birth_date = p_birth_date,
        school_name = nullif(btrim(coalesce(p_school_name, '')), ''),
        accommodation_notes = nullif(btrim(coalesce(p_accommodation_notes, '')), ''),
        updated_at = now()
    where id = p_child_id and parent_user_id = p_parent_user_id
    returning id into v_child_id;

    if v_child_id is null then
      raise exception 'CHILD_NOT_FOUND';
    end if;
  end if;

  if exists (
    select 1 from unnest(v_interest_ids) requested_id
    where not exists (
      select 1 from public.subjects
      where id = requested_id and moderation_status = 'active'
    )
  ) then
    raise exception 'INVALID_SUBJECT';
  end if;

  delete from public.parent_child_subject_interests where child_id = v_child_id;
  insert into public.parent_child_subject_interests (child_id, subject_id)
  select v_child_id, requested_id from unnest(v_interest_ids) requested_id
  on conflict do nothing;

  return v_child_id;
end;
$$;

revoke all on function public.save_parent_child_preferences(uuid, uuid, text, text, date, text, text, bigint[]) from public, anon, authenticated;
grant execute on function public.save_parent_child_preferences(uuid, uuid, text, text, date, text, text, bigint[]) to service_role;

notify pgrst, 'reload schema';
