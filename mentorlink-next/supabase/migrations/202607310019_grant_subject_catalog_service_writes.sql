grant select, insert
on table public.subjects
to service_role;

grant usage, select
on sequence public.subjects_id_seq
to service_role;

grant select, insert, update, delete
on table public.mentor_subjects
to service_role;

NOTIFY pgrst, 'reload schema';
