create table public.mentor_inquiries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  subject text check (subject is null or char_length(subject) between 1 and 120),
  child_grade_or_age text check (child_grade_or_age is null or char_length(child_grade_or_age) between 1 and 40),
  message text not null check (char_length(trim(message)) between 5 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed', 'cancelled')),
  mentor_response text check (
    mentor_response is null or char_length(trim(mentor_response)) between 2 and 1000
  ),
  responded_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_inquiries_idempotency_unique
    unique (parent_user_id, idempotency_key)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (
    char_length(endpoint) between 20 and 2048
    and endpoint like 'https://%'
  ),
  p256dh_key text not null check (char_length(p256dh_key) between 20 and 512),
  auth_key text not null check (char_length(auth_key) between 8 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_tested_at timestamptz,
  disabled_at timestamptz,
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (
    kind in (
      'meeting_request_created',
      'meeting_request_accepted',
      'meeting_request_declined',
      'meeting_alternative_proposed',
      'meeting_request_cancelled',
      'mentor_inquiry_created',
      'mentor_inquiry_responded',
      'mentor_inquiry_closed',
      'mentor_inquiry_cancelled'
    )
  );

create index mentor_inquiries_parent_history_idx
  on public.mentor_inquiries (parent_user_id, created_at desc);
create index mentor_inquiries_mentor_inbox_idx
  on public.mentor_inquiries (mentor_user_id, status, created_at desc);
create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, updated_at desc)
  where disabled_at is null;

alter table public.mentor_inquiries enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.mentor_inquiries from anon, authenticated, service_role;
revoke all on public.push_subscriptions from anon, authenticated, service_role;

grant select on public.mentor_inquiries to authenticated;
grant select, insert on public.mentor_inquiries to service_role;
grant update (
  status,
  mentor_response,
  responded_at,
  closed_at,
  cancelled_at,
  updated_at
) on public.mentor_inquiries to service_role;

grant select, insert, delete on public.push_subscriptions to service_role;
grant update (
  p256dh_key,
  auth_key,
  updated_at,
  last_used_at,
  last_tested_at,
  disabled_at
) on public.push_subscriptions to service_role;

grant select, insert, delete on public.push_subscriptions to authenticated;
grant update (
  p256dh_key,
  auth_key,
  updated_at,
  disabled_at
) on public.push_subscriptions to authenticated;

create policy "Participants read their mentor inquiries"
on public.mentor_inquiries for select to authenticated
using (parent_user_id = auth.uid() or mentor_user_id = auth.uid());

create policy "Users read their push subscriptions"
on public.push_subscriptions for select to authenticated
using (user_id = auth.uid());

create policy "Users create their push subscriptions"
on public.push_subscriptions for insert to authenticated
with check (user_id = auth.uid());

create policy "Users update their push subscriptions"
on public.push_subscriptions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users delete their push subscriptions"
on public.push_subscriptions for delete to authenticated
using (user_id = auth.uid());
