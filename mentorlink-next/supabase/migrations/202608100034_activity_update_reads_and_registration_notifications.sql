create table if not exists public.mentor_activity_update_reads (
  update_id uuid not null references public.mentor_activity_updates(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (update_id, parent_user_id)
);

alter table public.mentor_activity_update_reads enable row level security;
revoke all on public.mentor_activity_update_reads from public, anon, authenticated;
grant select, insert, update, delete on public.mentor_activity_update_reads to service_role;

create index if not exists mentor_activity_update_reads_parent_idx
  on public.mentor_activity_update_reads(parent_user_id, read_at desc);

create or replace function public.notify_mentor_activity_registration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity public.mentor_activities%rowtype;
begin
  if new.status not in ('registered', 'waitlisted') then return new; end if;
  select * into v_activity from public.mentor_activities where id = new.activity_id;
  if found then
    insert into public.notifications(user_id, kind, title, body, href)
    values (
      v_activity.mentor_user_id,
      'mentor_activity_update',
      case when new.status = 'registered' then 'הרשמה חדשה לפעילות' else 'הצטרפות לרשימת ההמתנה' end,
      format('%s נרשמ/ה לפעילות %s.', new.child_first_name, coalesce(v_activity.title, 'שלך')),
      '/dashboard/mentor/activity-registrations'
    );
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
