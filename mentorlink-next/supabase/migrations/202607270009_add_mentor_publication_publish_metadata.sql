alter table public.mentor_publication
  add column published_at timestamptz,
  add column published_by uuid references auth.users(id);

alter table public.mentor_publication
  add constraint mentor_publication_publish_metadata_valid
    check (
      status <> 'published'
      or (
        published_at is not null
        and published_by is not null
      )
    )
    not valid;

grant update (
  published_at,
  published_by
)
on public.mentor_publication
to service_role;
