create table public.mentor_availability_window_subjects (
  window_id uuid not null references public.mentor_availability_windows(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (window_id, subject_id)
);

alter table public.mentor_availability_window_subjects enable row level security;

revoke all on table public.mentor_availability_window_subjects from anon, authenticated;
grant select, insert, delete on table public.mentor_availability_window_subjects to service_role;
grant delete on table public.subjects to service_role;

create index mentor_availability_window_subjects_subject_idx
  on public.mentor_availability_window_subjects (subject_id);

NOTIFY pgrst, 'reload schema';
