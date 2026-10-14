-- Golfers Practice Hub · update 3: club distances ("My bag")
-- Run in Supabase → SQL Editor. Safe to re-run.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('lesson', 'drill', 'stat', 'plan', 'fitness', 'note', 'session', 'goal', 'bag'));

create unique index if not exists entries_one_bag_per_student
  on public.entries (student_id) where type = 'bag';

-- Students can create and edit their own club distances (like goals).
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag'))
  );

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session') and created_by = auth.uid())
    or (student_id in (select my_students()) and type in ('goal', 'bag'))
  ) with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag'))
  );
