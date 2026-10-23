-- Golfers Practice Hub · update 7: the practice version (newsletter sign-ups)
-- Supabase → SQL Editor → New query → paste → Run. Safe to run again.
-- Then set the newsletter sign-up code (see the last line of this file).
--
-- What it does
--   • Students now have a kind: 'coached' (Karina's students, invited as before) or 'solo' (practice version).
--   • Anyone with the newsletter link (it carries the sign-up code) who confirms they are 18 or older can
--     create a practice-version account. Without the code, sign-up is refused as before.
--   • Practice-version users choose whether Karina can see their stats (off by default). If it's off,
--     Karina's view can't read their name, stats or anything else; she only sees totals.
--   • "Work with Karina" requests turn sharing on, email Karina, and show up in her check-in.
--   • No emails to Karina about practice-version users' rounds or practice. No video uploads or AI for them.

-- ---------------------------------------------------------------
-- 1. New student fields
-- ---------------------------------------------------------------
alter table public.students add column if not exists kind text not null default 'coached';
alter table public.students drop constraint if exists students_kind_check;
alter table public.students add constraint students_kind_check check (kind in ('coached', 'solo'));
alter table public.students add column if not exists share_with_coach boolean not null default false;
alter table public.students add column if not exists founding boolean not null default false;
alter table public.students add column if not exists coaching_request_at timestamptz;
alter table public.students add column if not exists coaching_request_note text;

create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value) values ('join_code', 'PASTE_JOIN_CODE') on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- 2. What Karina can see: her students, plus practice-version users who share with her
-- ---------------------------------------------------------------
create or replace function public.coach_can(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_coach() and exists (select 1 from students s where s.id = sid and (s.kind = 'coached' or s.share_with_coach));
$$;

drop policy if exists students_coach_all on public.students;
drop policy if exists students_coach_read on public.students;
drop policy if exists students_coach_add on public.students;
drop policy if exists students_coach_edit on public.students;
drop policy if exists students_coach_delete on public.students;
create policy students_coach_read on public.students
  for select using (is_coach() and (kind = 'coached' or share_with_coach));
create policy students_coach_add on public.students
  for insert with check (is_coach());
create policy students_coach_edit on public.students
  for update using (is_coach() and (kind = 'coached' or share_with_coach)) with check (is_coach());
create policy students_coach_delete on public.students
  for delete using (is_coach() and (kind = 'coached' or share_with_coach));

drop policy if exists student_users_read on public.student_users;
create policy student_users_read on public.student_users
  for select using (coach_can(student_id) or user_id = auth.uid());

drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries
  for select using (coach_can(student_id) or student_id in (select my_students()));

drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (
    coach_can(student_id)
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag', 'pattern'))
  );

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (
    coach_can(student_id)
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'pattern') and created_by = auth.uid())
    or (student_id in (select my_students()) and type in ('goal', 'bag'))
  ) with check (
    coach_can(student_id)
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'goal', 'bag', 'pattern'))
  );

drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries
  for delete using (
    coach_can(student_id)
    or (student_id in (select my_students()) and type in ('stat', 'note', 'session', 'pattern') and created_by = auth.uid())
  );

drop policy if exists scores_read on public.drill_scores;
create policy scores_read on public.drill_scores
  for select using (coach_can(student_id) or student_id in (select my_students()));

drop policy if exists scores_insert on public.drill_scores;
create policy scores_insert on public.drill_scores
  for insert with check (
    coach_can(student_id)
    or (student_id in (select my_students())
        and exists (select 1 from entries d where d.id = drill_id and d.student_id = drill_scores.student_id and d.type = 'drill'))
  );

drop policy if exists scores_delete on public.drill_scores;
create policy scores_delete on public.drill_scores
  for delete using (coach_can(student_id) or created_by = auth.uid());

create or replace function public.set_plan_done(entry_id uuid, is_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update entries
     set data = data || jsonb_build_object('done', is_done, 'done_at', case when is_done then now() else null end),
         updated_at = now()
   where id = entry_id and type = 'plan'
     and (coach_can(student_id) or student_id in (select my_students()));
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.last_seen_by_student() returns table (student_id uuid, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select su.student_id, max(su.last_seen) from student_users su where coach_can(su.student_id) group by su.student_id;
$$;

-- The profile students read (now also says which version they're on).
create or replace view public.students_public with (security_invoker = false) as
  select id, name, grp, handicap, program, start_date, next_lesson, goals, kind, share_with_coach, founding, coaching_request_at
  from public.students
  where not archived and (coach_can(id) or id in (select my_students()));
revoke insert, update, delete, truncate on public.students_public from anon, authenticated, public;
revoke select on public.students_public from anon, public;
grant select on public.students_public to authenticated;

-- Files: Karina only sees files of students she can see; only coached students can upload.
drop policy if exists practice_files_read on storage.objects;
create policy practice_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'practice-files'
         and ((is_coach() and split_part(name, '/', 1) in (select id::text from students where kind = 'coached' or share_with_coach))
              or split_part(name, '/', 1) in (select my_students()::text)));
drop policy if exists practice_files_add on storage.objects;
create policy practice_files_add on storage.objects
  for insert to authenticated
  with check (bucket_id = 'practice-files'
              and ((is_coach() and split_part(name, '/', 1) in (select id::text from students where kind = 'coached'))
                   or split_part(name, '/', 1) in (select id::text from students where kind = 'coached' and id in (select my_students()))));

-- ---------------------------------------------------------------
-- 3. Sign-in: who am I, and newsletter sign-ups
-- ---------------------------------------------------------------
create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', case when is_coach() then 'coach'
                 when exists (select 1 from my_students()) then 'student'
                 else 'none' end,
    'coached', is_coach() or exists (select 1 from students s where s.id in (select my_students()) and s.kind = 'coached'),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'kind', s.kind) order by s.name)
                          from students s where s.id in (select my_students())), '[]'::jsonb)
  );
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  e text := lower(new.email);
  n int;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  code text;
  nm text;
begin
  if exists (select 1 from coach_emails where lower(email) = e) then
    insert into coaches (user_id) values (new.id) on conflict do nothing;
    return new;
  end if;
  insert into student_users (user_id, student_id)
    select new.id, s.id from students s
    where not s.archived and (lower(s.email) = e or lower(s.guardian_email) = e)
    on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then return new; end if;
  -- Practice version: needs the current newsletter code and confirmation they are 18 or older.
  select value into code from private.settings where key = 'join_code';
  if code is not null and code <> 'PASTE_JOIN_CODE' and coalesce(meta->>'join', '') <> ''
     and lower(trim(meta->>'join')) = lower(trim(code)) and meta->>'adult' = 'true' then
    nm := left(coalesce(nullif(trim(meta->>'name'), ''), split_part(e, '@', 1)), 60);
    insert into students (name, email, grp, kind, share_with_coach, founding, program, start_date)
      values (nm, e, 'Adult', 'solo', coalesce(meta->>'share', '') = 'true', true, 'Practice app', current_date);
    -- The on_student_saved trigger links this new sign-in to the new space.
    return new;
  end if;
  raise exception 'not_invited';
end $$;

-- ---------------------------------------------------------------
-- 4. Things practice-version users can do themselves
-- ---------------------------------------------------------------
create or replace function public.set_sharing(sid uuid, share boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update students set share_with_coach = share
   where id = sid and kind = 'solo' and id in (select my_students());
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.request_coaching(sid uuid, note text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  st record; u text; s text;
begin
  update students set coaching_request_at = now(), coaching_request_note = left(coalesce(note, ''), 1000), share_with_coach = true
   where id = sid and kind = 'solo' and id in (select my_students())
   returning name, email into st;
  if not found then raise exception 'not_allowed'; end if;
  begin
    select value into u from private.settings where key = 'notify_url';
    select value into s from private.settings where key = 'notify_secret';
    if u is not null and s is not null and s <> 'PASTE_NOTIFY_SECRET' then
      perform net.http_post(
        url := u,
        body := jsonb_build_object('direction', 'to_coach', 'type', 'coaching_request', 'student_name', st.name, 'recipients', '[]'::jsonb,
                                   'data', jsonb_build_object('email', st.email, 'note', left(coalesce(note, ''), 1000))),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
        timeout_milliseconds := 5000);
    end if;
  exception when others then null; -- the request is saved even if the email fails
  end;
end $$;

-- Deletes a practice-version account and everything in it.
create or replace function public.delete_practice_account(sid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  delete from students where id = sid and kind = 'solo' and id in (select my_students());
  if not found then raise exception 'not_allowed'; end if;
  if not exists (select 1 from student_users where user_id = me) and not exists (select 1 from coaches where user_id = me) then
    begin
      delete from auth.users where id = me;
    exception when others then null; -- the data is gone either way
    end;
  end if;
end $$;

-- Karina: totals only (no names or stats unless they share).
create or replace function public.practice_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_coach() then null else jsonb_build_object(
    'signups', (select count(*) from students where kind = 'solo'),
    'new_week', (select count(*) from students where kind = 'solo' and created_at > now() - interval '7 days'),
    'sharing', (select count(*) from students where kind = 'solo' and share_with_coach),
    'requests', (select count(*) from students where kind = 'solo' and coaching_request_at is not null),
    'active_week', (select count(distinct e.student_id) from entries e join students s on s.id = e.student_id
                    where s.kind = 'solo' and e.created_at > now() - interval '7 days'),
    'rounds_week', (select count(*) from entries e join students s on s.id = e.student_id
                    where s.kind = 'solo' and e.type = 'stat' and e.created_at > now() - interval '7 days'),
    'practice_week', (select count(*) from entries e join students s on s.id = e.student_id
                      where s.kind = 'solo' and e.type in ('session', 'pattern') and e.created_at > now() - interval '7 days')
  ) end;
$$;

-- ---------------------------------------------------------------
-- 5. No emails to Karina about practice-version users' posts
-- ---------------------------------------------------------------
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
  select name, email, guardian_email, archived, kind into st from students where id = new.student_id;
  if st.kind = 'solo' then return new; end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then
    return new;
  end if;
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
  return new;
end $$;

create or replace function public.notify_goal_update() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  u text; s text; n text;
begin
  if is_coach() or new.type <> 'goal'
     or (coalesce(old.data->'m3', 'null') = coalesce(new.data->'m3', 'null') and coalesce(old.data->'m6', 'null') = coalesce(new.data->'m6', 'null')) then
    return new;
  end if;
  if exists (select 1 from students where id = new.student_id and kind = 'solo') then return new; end if;
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

-- ---------------------------------------------------------------
-- 6. The newsletter sign-up code is set separately (see SETUP.md, "Update 7"), so running this file
--    again never changes it. Until it's set, sign-ups stay closed.
-- ---------------------------------------------------------------
