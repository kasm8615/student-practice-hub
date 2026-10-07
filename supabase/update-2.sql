-- Golfers Practice Hub · update 2: goals, practice log, emails to students
-- Run in Supabase → SQL Editor after schema.sql and notify.sql. Safe to re-run.
-- Uses the notify secret already saved by notify.sql, so nothing needs replacing.

-- 1. Two new kinds of entry: 'goal' (one per student) and 'session' (a practice log).
alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('lesson', 'drill', 'stat', 'plan', 'fitness', 'note', 'session', 'goal'));

create unique index if not exists entries_one_goal_per_student
  on public.entries (student_id) where type = 'goal';

-- 2. Students may write rounds, notes, practice logs and their goals.
--    Rounds, notes and practice logs: only edit or delete their own.
--    Goals: shared with the coach, so either can edit (only the coach can delete).
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal'))
  );

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session') and created_by = auth.uid())
    or (student_id in (select my_students()) and type = 'goal')
  ) with check (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal'))
  );

drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries
  for delete using (
    is_coach()
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session') and created_by = auth.uid())
  );

-- 3. Emails: to the coach when a student posts, to the student (and parent) when the coach posts.
create or replace function public.notify_coach() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  u text;
  s text;
  st record;
  dir text;
  rcpt jsonb := '[]'::jsonb;
begin
  if new.author = 'student' and new.type in ('note', 'stat', 'session', 'goal') then
    dir := 'to_coach';
  elsif new.author = 'coach' and new.type in ('note', 'lesson') then
    dir := 'to_student';
  else
    return new;
  end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then
    return new;
  end if;
  select name, email, guardian_email, archived into st from students where id = new.student_id;
  if dir = 'to_student' then
    if st.archived then return new; end if;
    select coalesce(jsonb_agg(distinct lower(e)), '[]'::jsonb) into rcpt
      from unnest(array[st.email, st.guardian_email]) as e where e is not null and e <> '';
    if jsonb_array_length(rcpt) = 0 then return new; end if;
  end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('direction', dir, 'type', new.type, 'student_name', st.name, 'recipients', rcpt, 'data', new.data),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never block a post because an email failed.
  return new;
end $$;

drop trigger if exists on_student_post on public.entries;
create trigger on_student_post
  after insert on public.entries
  for each row execute function public.notify_coach();
