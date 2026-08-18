alter table public.parent_children
  add column if not exists gender text,
  add column if not exists display_color text;

alter table public.parent_children drop constraint if exists parent_children_gender_check;
alter table public.parent_children add constraint parent_children_gender_check check (gender is null or gender in ('boy', 'girl'));
alter table public.parent_children drop constraint if exists parent_children_display_color_check;
alter table public.parent_children add constraint parent_children_display_color_check check (display_color is null or display_color in ('green', 'blue', 'turquoise', 'peach', 'pink', 'red', 'violet', 'amber'));

with ranked as (
  select id, coalesce(gender, 'boy') as resolved_gender,
    row_number() over (partition by parent_user_id, coalesce(gender, 'boy') order by created_at, id) as position
  from public.parent_children
)
update public.parent_children child
set gender = ranked.resolved_gender,
    display_color = case when ranked.resolved_gender = 'girl'
      then (array['peach','pink','red','violet','amber'])[((ranked.position - 1) % 5) + 1]
      else (array['green','blue','turquoise','violet','amber'])[((ranked.position - 1) % 5) + 1] end
from ranked where ranked.id = child.id and (child.gender is null or child.display_color is null);

alter table public.parent_children alter column gender set default 'boy';
alter table public.parent_children alter column display_color set default 'green';
alter table public.parent_children alter column gender set not null;
alter table public.parent_children alter column display_color set not null;

create or replace function public.submit_minor_mentor_after_parent_consent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
    and exists (select 1 from auth.users where id = new.user_id and email_confirmed_at is not null)
    and exists (select 1 from public.mentor_profiles where user_id = new.user_id and trim(first_name) <> '' and trim(last_name) <> '' and birth_date is not null)
    and exists (select 1 from public.mentor_subjects where user_id = new.user_id)
    and exists (select 1 from public.mentor_experience where user_id = new.user_id and trim(relationship_values) <> '' and trim(motivation) <> '' and cardinality(mentoring_types) > 0)
  then
    insert into public.mentor_publication (user_id, status, submitted_at, updated_at)
    values (new.user_id, 'pending_review', now(), now())
    on conflict (user_id) do update set
      status = case when public.mentor_publication.status in ('draft','rejected') then 'pending_review' else public.mentor_publication.status end,
      submitted_at = case when public.mentor_publication.status in ('draft','rejected') then now() else public.mentor_publication.submitted_at end,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists submit_minor_mentor_after_parent_consent on public.mentor_parent_consents;
create trigger submit_minor_mentor_after_parent_consent after update of status on public.mentor_parent_consents
for each row execute function public.submit_minor_mentor_after_parent_consent();
