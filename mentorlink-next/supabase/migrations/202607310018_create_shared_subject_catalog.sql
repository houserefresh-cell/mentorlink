alter table public.subjects
  add column if not exists category text,
  add column if not exists normalized_name text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_status text not null default 'active';

update public.subjects
set category = case
  when name in ('כדורגל', 'ספורט וכושר') then 'ספורט'
  when name in ('מתמטיקה', 'אנגלית', 'עברית', 'קריאה וכתיבה', 'מדעים', 'הכנת שיעורי בית', 'מיומנויות למידה') then 'לימודים'
  when name = 'מוזיקה' then 'מוזיקה'
  when name = 'אמנות ויצירה' then 'אומנות ויצירה'
  when name = 'מחשבים וטכנולוגיה' then 'טכנולוגיה'
  else 'כישורי חיים והעשרה'
end
where category is null;

update public.subjects
set normalized_name = lower(regexp_replace(name, '[[:space:]''"׳״-]+', '', 'g'))
where normalized_name is null;

update public.subjects
set moderation_status = 'blocked'
where name = 'אחר';

alter table public.subjects
  alter column category set not null,
  alter column normalized_name set not null;

alter table public.subjects
  add constraint subjects_category_allowed check (
    category in ('ספורט', 'לימודים', 'מוזיקה', 'אומנות ויצירה', 'טכנולוגיה', 'שפות', 'כישורי חיים והעשרה')
  ),
  add constraint subjects_moderation_status_allowed check (
    moderation_status in ('active', 'flagged', 'blocked')
  ),
  add constraint subjects_name_length check (char_length(name) between 2 and 50);

create unique index if not exists subjects_normalized_name_unique
  on public.subjects (normalized_name);

insert into public.subjects (name, category, normalized_name)
values
  ('כדורסל', 'ספורט', 'כדורסל'),
  ('טניס', 'ספורט', 'טניס'),
  ('שחייה', 'ספורט', 'שחייה'),
  ('כושר', 'ספורט', 'כושר'),
  ('היסטוריה', 'לימודים', 'היסטוריה'),
  ('גיטרה', 'מוזיקה', 'גיטרה'),
  ('פסנתר', 'מוזיקה', 'פסנתר'),
  ('פיתוח קול', 'מוזיקה', 'פיתוחקול'),
  ('תופים', 'מוזיקה', 'תופים'),
  ('ציור', 'אומנות ויצירה', 'ציור'),
  ('פיסול', 'אומנות ויצירה', 'פיסול'),
  ('צילום', 'אומנות ויצירה', 'צילום'),
  ('יצירה', 'אומנות ויצירה', 'יצירה'),
  ('תכנות', 'טכנולוגיה', 'תכנות'),
  ('רובוטיקה', 'טכנולוגיה', 'רובוטיקה'),
  ('מחשבים', 'טכנולוגיה', 'מחשבים'),
  ('בינה מלאכותית', 'טכנולוגיה', 'בינהמלאכותית'),
  ('אנגלית מדוברת', 'שפות', 'אנגליתמדוברת'),
  ('ספרדית', 'שפות', 'ספרדית'),
  ('צרפתית', 'שפות', 'צרפתית'),
  ('ביטחון עצמי', 'כישורי חיים והעשרה', 'ביטחוןעצמי'),
  ('התארגנות', 'כישורי חיים והעשרה', 'התארגנות'),
  ('מנהיגות', 'כישורי חיים והעשרה', 'מנהיגות'),
  ('משחקי חשיבה', 'כישורי חיים והעשרה', 'משחקיחשיבה')
on conflict (normalized_name) do nothing;

drop policy if exists "Authenticated users can read subjects" on public.subjects;
create policy "Authenticated users can read active subjects"
on public.subjects for select to authenticated
using (moderation_status = 'active');
