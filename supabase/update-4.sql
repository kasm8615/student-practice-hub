-- Golfers Practice Hub · update 4: security fixes from the review. Run in Supabase → SQL Editor. Safe to re-run.

-- 1. The read-only profile view must stay read-only (it bypasses row security, so no writes through it).
revoke insert, update, delete, truncate on public.students_public from anon, authenticated, public;
revoke select on public.students_public from anon, public;
grant select on public.students_public to authenticated;

-- 2. Students can't change what an entry is or who it belongs to, and can't write Karina's goal note.
create or replace function public.guard_student_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_coach() then return new; end if;
  if tg_op = 'UPDATE' then
    if new.type <> old.type or new.student_id <> old.student_id then
      raise exception 'not_allowed';
    end if;
    if new.type = 'goal' then
      new.data := (new.data - 'coach_note' - 'coach_note_at')
        || jsonb_strip_nulls(jsonb_build_object('coach_note', old.data->'coach_note', 'coach_note_at', old.data->'coach_note_at'));
    end if;
  elsif new.type = 'goal' then
    new.data := new.data - 'coach_note' - 'coach_note_at';
  end if;
  return new;
end $$;

drop trigger if exists on_entry_guard on public.entries;
create trigger on_entry_guard
  before insert or update on public.entries
  for each row execute function public.guard_student_write();

-- 3. Give older practice blocks (weekday only) a real date in the current week, so they stop repeating every week.
update public.entries e
   set data = e.data || jsonb_build_object('date', to_char(
         date_trunc('week', (now() at time zone 'America/New_York'))::date
         + (array_position(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], e.data->>'day') - 1), 'YYYY-MM-DD'))
 where e.type = 'plan'
   and coalesce(e.data->>'date', '') = ''
   and e.data->>'day' in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun');

-- 4. Email Karina when a student changes their goals (not only the first time).
create or replace function public.notify_goal_update() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  u text; s text; n text;
begin
  if is_coach() or new.type <> 'goal'
     or (coalesce(old.data->'m3', 'null') = coalesce(new.data->'m3', 'null') and coalesce(old.data->'m6', 'null') = coalesce(new.data->'m6', 'null')) then
    return new;
  end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then return new; end if;
  select name into n from students where id = new.student_id;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('direction', 'to_coach', 'type', 'goal', 'student_name', n, 'recipients', '[]'::jsonb, 'data', new.data),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
    timeout_milliseconds := 5000);
  return new;
exception when others then return new;
end $$;

drop trigger if exists on_goal_update on public.entries;
create trigger on_goal_update
  after update on public.entries
  for each row execute function public.notify_goal_update();
