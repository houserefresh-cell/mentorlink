create table if not exists public.admin_deleted_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('parent', 'mentor')),
  email text, display_name text, reason text,
  warnings jsonb not null default '[]'::jsonb,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null references auth.users(id),
  restored_at timestamptz, restored_by uuid references auth.users(id)
);
alter table public.admin_deleted_accounts enable row level security;
revoke all on public.admin_deleted_accounts from anon, authenticated;
create index if not exists admin_deleted_accounts_active_idx on public.admin_deleted_accounts(deleted_at desc) where restored_at is null;
notify pgrst, 'reload schema';
