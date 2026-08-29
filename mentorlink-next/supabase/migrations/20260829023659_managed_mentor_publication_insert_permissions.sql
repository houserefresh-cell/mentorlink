grant insert (
  user_id,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by,
  updated_at
)
on public.mentor_publication
to service_role;

notify pgrst, 'reload schema';