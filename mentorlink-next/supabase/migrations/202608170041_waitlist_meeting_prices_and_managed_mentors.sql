alter table public.mentor_availability_windows
  add column if not exists meeting_price numeric(10,2) not null default 0;

alter table public.mentor_availability_windows
  drop constraint if exists mentor_availability_windows_meeting_price_check;
alter table public.mentor_availability_windows
  add constraint mentor_availability_windows_meeting_price_check
  check (meeting_price in (0, 10, 20, 30));

alter table public.meeting_requests
  add column if not exists meeting_price numeric(10,2) not null default 0;

grant select, insert, update, delete on public.mentor_account_ownership to service_role;
grant select, insert, update, delete on public.mentor_availability_windows to service_role;
grant select, insert, update, delete on public.meeting_requests to service_role;

create or replace function public.enforce_single_activity_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'waitlisted' then
    return new;
  end if;
  perform 1 from public.mentor_activities where id = new.activity_id for update;
  if exists (
    select 1 from public.mentor_activity_registrations
    where activity_id = new.activity_id
      and status = 'waitlisted'
      and id is distinct from new.id
  ) then
    raise exception 'ACTIVITY_WAITLIST_FULL';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_activity_waitlist_trigger
  on public.mentor_activity_registrations;
create trigger enforce_single_activity_waitlist_trigger
before insert or update of status on public.mentor_activity_registrations
for each row execute function public.enforce_single_activity_waitlist();

notify pgrst, 'reload schema';
