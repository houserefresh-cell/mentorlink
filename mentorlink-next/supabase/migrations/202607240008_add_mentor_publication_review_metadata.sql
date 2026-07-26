alter table public.mentor_publication
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id),
  add column rejection_reason text;

alter table public.mentor_publication
  drop constraint mentor_publication_status_allowed,
  add constraint mentor_publication_status_allowed
    check (
      status in (
        'draft',
        'pending_review',
        'approved',
        'published',
        'rejected',
        'paused'
      )
    ),
  add constraint mentor_publication_review_metadata_valid
    check (
      status not in ('approved', 'rejected')
      or (
        reviewed_at is not null
        and reviewed_by is not null
        and (
          (status = 'approved' and rejection_reason is null)
          or (
            status = 'rejected'
            and rejection_reason is not null
            and char_length(trim(rejection_reason)) between 3 and 1000
          )
        )
      )
    )
    not valid;

grant update (
  status,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  updated_at
)
on public.mentor_publication
to service_role;
