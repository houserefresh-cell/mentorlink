grant delete
  on public.mentor_public_pending_changes
  to service_role;

NOTIFY pgrst, 'reload schema';