alter table public.parent_children
  add column if not exists default_mentor_message text,
  add column if not exists auto_include_mentor_message boolean not null default false;
alter table public.parent_children drop constraint if exists parent_children_default_mentor_message_length;
alter table public.parent_children add constraint parent_children_default_mentor_message_length check (default_mentor_message is null or char_length(default_mentor_message) <= 1000);

create table if not exists public.mentor_inquiry_messages (
  id uuid primary key default gen_random_uuid(), inquiry_id uuid not null references public.mentor_inquiries(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('parent','mentor')),
  body text not null check (char_length(trim(body)) between 1 and 1000), created_at timestamptz not null default now()
);
insert into public.mentor_inquiry_messages(inquiry_id,sender_user_id,sender_role,body,created_at)
select id,parent_user_id,'parent',message,created_at from public.mentor_inquiries i where not exists (select 1 from public.mentor_inquiry_messages m where m.inquiry_id=i.id and m.sender_role='parent');
insert into public.mentor_inquiry_messages(inquiry_id,sender_user_id,sender_role,body,created_at)
select id,mentor_user_id,'mentor',mentor_response,coalesce(responded_at,updated_at) from public.mentor_inquiries i where mentor_response is not null and not exists (select 1 from public.mentor_inquiry_messages m where m.inquiry_id=i.id and m.sender_role='mentor');
create index if not exists mentor_inquiry_messages_thread_idx on public.mentor_inquiry_messages(inquiry_id,created_at);
alter table public.mentor_inquiry_messages enable row level security;
revoke all on public.mentor_inquiry_messages from public,anon,authenticated;
grant select,insert on public.mentor_inquiry_messages to service_role;
alter table public.mentor_inquiries add column if not exists archived_at timestamptz;
grant update (status,mentor_response,responded_at,closed_at,cancelled_at,archived_at,updated_at) on public.mentor_inquiries to service_role;
