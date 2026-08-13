alter table public.parent_children
  add column if not exists removed_at timestamptz;

alter table public.meeting_requests
  add column if not exists child_id uuid references public.parent_children(id) on delete restrict,
  add column if not exists archived_by_parent_at timestamptz,
  add column if not exists preparation_notes text,
  add column if not exists equipment_notes text,
  add column if not exists meeting_location text,
  add column if not exists participant_names text[] not null default '{}';

create index if not exists meeting_requests_child_id_idx
  on public.meeting_requests(child_id)
  where child_id is not null;

create table if not exists public.mentor_meeting_preparation_templates (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  preparation_notes text,
  equipment_notes text,
  meeting_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_user_id, subject)
);

alter table public.mentor_meeting_preparation_templates enable row level security;

drop policy if exists mentor_meeting_preparation_templates_owner on public.mentor_meeting_preparation_templates;
create policy mentor_meeting_preparation_templates_owner
on public.mentor_meeting_preparation_templates
for all to authenticated
using (mentor_user_id = auth.uid())
with check (mentor_user_id = auth.uid());

grant select, insert, update, delete on public.mentor_meeting_preparation_templates to authenticated;
