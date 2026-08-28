alter table public.mentor_account_ownership
  add column if not exists created_by_administrator boolean not null default false;

update public.mentor_account_ownership as ownership
set created_by_administrator = true
from auth.users as account
where account.id = ownership.user_id
  and ownership.owner_type = 'mentor'
  and account.raw_user_meta_data ->> 'created_by_administrator' = 'true';

insert into public.mentor_publication (user_id, status, submitted_at, updated_at)
select ownership.user_id, 'approved', now(), now()
from public.mentor_account_ownership as ownership
where ownership.owner_type = 'mentor'
  and ownership.created_by_administrator
on conflict (user_id) do update
set
  status = case
    when public.mentor_publication.status in ('draft', 'pending_review', 'rejected') then 'approved'
    else public.mentor_publication.status
  end,
  submitted_at = coalesce(public.mentor_publication.submitted_at, now()),
  updated_at = now();

notify pgrst, 'reload schema';
