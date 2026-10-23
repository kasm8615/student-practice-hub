-- Golfers Practice Hub · update 6: shot patterns (dispersion tests at the range)
-- Supabase → SQL Editor → New query → paste → Run. Safe to run again. No values to replace.
--
-- Adds a new entry type, "pattern": one range session (test or game mode) with every shot's
-- finish spot, contact rating and miss type. Students add and delete their own; Karina sees all.
-- Same privacy as everything else: only the student's own space and Karina can read them.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('lesson', 'drill', 'stat', 'plan', 'fitness', 'note', 'session', 'goal', 'bag', 'pattern'));

drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag', 'pattern'))
  );

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'pattern') and created_by = auth.uid())
    or (student_id in (select my_students()) and type in ('goal', 'bag'))
  ) with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag', 'pattern'))
  );

drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries
  for delete using (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'pattern') and created_by = auth.uid())
  );
