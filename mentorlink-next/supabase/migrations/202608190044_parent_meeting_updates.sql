create table if not exists public.meeting_request_updates (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null references public.meeting_requests(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  update_type text not null check (update_type in ('cancellation', 'details', 'reschedule')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists meeting_request_updates_parent_created_idx
  on public.meeting_request_updates(parent_user_id, created_at desc);

alter table public.meeting_request_updates enable row level security;
revoke all on table public.meeting_request_updates from anon, authenticated;
grant all on table public.meeting_request_updates to service_role;

create or replace function public.record_parent_meeting_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_kind text;
  update_body text;
begin
  if new.status = 'cancelled'
     and old.status is distinct from new.status
     and nullif(btrim(new.cancellation_reason), '') is not null then
    update_kind := 'cancellation';
    update_body := 'הפגישה בוטלה על ידי החונך. הסיבה: ' || btrim(new.cancellation_reason);
  elsif new.proposed_start_at is not null
        and old.proposed_start_at is distinct from new.proposed_start_at then
    update_kind := 'reschedule';
    update_body := 'החונך הציע מועד חדש לפגישה. יש להיכנס לכרטיס הפגישה כדי לאשר או לדחות.';
  elsif old.preparation_notes is distinct from new.preparation_notes
        or old.equipment_notes is distinct from new.equipment_notes
        or old.meeting_location is distinct from new.meeting_location
        or old.participant_names is distinct from new.participant_names then
    update_kind := 'details';
    update_body := 'החונך עדכן את פרטי המפגש, ההכנה, הציוד או המיקום.';
  end if;

  if update_kind is not null then
    insert into public.meeting_request_updates (
      meeting_request_id, parent_user_id, update_type, body, created_at
    ) values (
      new.id, new.parent_user_id, update_kind, update_body, now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists record_parent_meeting_update_trigger on public.meeting_requests;
create trigger record_parent_meeting_update_trigger
after update on public.meeting_requests
for each row execute function public.record_parent_meeting_update();

insert into public.meeting_request_updates (
  meeting_request_id, parent_user_id, update_type, body, created_at
)
select
  request.id,
  request.parent_user_id,
  'cancellation',
  'הפגישה בוטלה על ידי החונך. הסיבה: ' || btrim(request.cancellation_reason),
  coalesce(request.cancelled_at, request.updated_at, now())
from public.meeting_requests request
where request.status = 'cancelled'
  and nullif(btrim(request.cancellation_reason), '') is not null
  and not exists (
    select 1
    from public.meeting_request_updates existing
    where existing.meeting_request_id = request.id
      and existing.update_type = 'cancellation'
  );
