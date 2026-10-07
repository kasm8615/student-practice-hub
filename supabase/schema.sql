-- Student Practice Hub · database schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: it drops and recreates functions, triggers and policies (not data).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

-- Emails allowed to sign in as coach. Karina's is added at the bottom.
create table if not exists public.coach_emails (
  email text primary key
);

create table if not exists public.coaches (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,                 -- the student's own sign-in email (adults, older juniors)
  guardian_email text,        -- a parent's sign-in email (juniors)
  grp text not null default 'Adult' check (grp in ('Adult', 'Junior')),
  handicap text,
  program text,
  start_date date,
  next_lesson date,
  goals text,
  coach_notes text,           -- visible to the coach only (see students_public view)
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Which signed-in people can see which student. Filled by triggers, never by the app.
create table if not exists public.student_users (
  user_id uuid not null references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  last_seen timestamptz,
  primary key (user_id, student_id)
);

-- Lessons, drills, rounds (stat), practice blocks (plan), fitness, notes.
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students on delete cascade,
  type text not null check (type in ('lesson', 'drill', 'stat', 'plan', 'fitness', 'note', 'session', 'goal')),
  data jsonb not null default '{}'::jsonb,
  author text not null default 'student' check (author in ('coach', 'student')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entries_student_type on public.entries (student_id, type);
create unique index if not exists entries_one_goal_per_student on public.entries (student_id) where type = 'goal';

create table if not exists public.drill_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students on delete cascade,
  drill_id uuid not null references public.entries on delete cascade,
  score int not null check (score >= 0),
  out_of int not null check (out_of > 0),
  scored_on date not null default current_date,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists drill_scores_student on public.drill_scores (student_id, drill_id);

-- ---------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coaches where user_id = auth.uid());
$$;

create or replace function public.my_students() returns setof uuid
language sql stable security definer set search_path = public as $$
  select su.student_id from student_users su
  join students s on s.id = su.student_id
  where su.user_id = auth.uid() and not s.archived;
$$;

-- Who is signed in, and which students they can open.
create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', case when is_coach() then 'coach'
                 when exists (select 1 from my_students()) then 'student'
                 else 'none' end,
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name)
                          from students s where s.id in (select my_students())), '[]'::jsonb)
  );
$$;

-- Students tick practice blocks on and off without being able to edit them.
create or replace function public.set_plan_done(entry_id uuid, is_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update entries
     set data = data || jsonb_build_object('done', is_done, 'done_at', case when is_done then now() else null end),
         updated_at = now()
   where id = entry_id and type = 'plan'
     and (is_coach() or student_id in (select my_students()));
  if not found then raise exception 'not_allowed'; end if;
end $$;

-- Records when a student or parent last opened the app (for the coach check-in).
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update student_users set last_seen = now() where user_id = auth.uid();
$$;

-- Coach check-in: last time anyone opened each student's space.
create or replace function public.last_seen_by_student() returns table (student_id uuid, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select su.student_id, max(su.last_seen) from student_users su where is_coach() group by su.student_id;
$$;

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------

-- New sign-ins: only the coach and invited students/parents get an account.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(new.email);
  n int;
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
  if n = 0 then
    raise exception 'not_invited';
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Adding a student (or changing their emails) links anyone who already has a login.
create or replace function public.link_student_users() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from student_users su
   where su.student_id = new.id
     and su.user_id not in (select u.id from auth.users u
                            where lower(u.email) in (lower(coalesce(new.email, '')), lower(coalesce(new.guardian_email, ''))));
  insert into student_users (user_id, student_id)
    select u.id, new.id from auth.users u
    where lower(u.email) in (lower(coalesce(new.email, '')), lower(coalesce(new.guardian_email, '')))
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_student_saved on public.students;
create trigger on_student_saved
  after insert or update of email, guardian_email on public.students
  for each row execute function public.link_student_users();

-- Stamp who wrote each entry and keep updated_at current.
create or replace function public.stamp_entry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author := case when is_coach() then 'coach' else 'student' end;
    new.created_by := auth.uid();
  else
    new.author := old.author;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists on_entry_write on public.entries;
create trigger on_entry_write
  before insert or update on public.entries
  for each row execute function public.stamp_entry();

-- ---------------------------------------------------------------
-- Row level security: each student sees only their own space
-- ---------------------------------------------------------------

alter table public.coach_emails enable row level security;
alter table public.coaches enable row level security;
alter table public.students enable row level security;
alter table public.student_users enable row level security;
alter table public.entries enable row level security;
alter table public.drill_scores enable row level security;

-- coach_emails and coaches: no policies, so the app can't read or change them.

drop policy if exists students_coach_all on public.students;
create policy students_coach_all on public.students
  for all using (is_coach()) with check (is_coach());

drop policy if exists student_users_read on public.student_users;
create policy student_users_read on public.student_users
  for select using (is_coach() or user_id = auth.uid());

drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries
  for select using (is_coach() or student_id in (select my_students()));

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

drop policy if exists scores_read on public.drill_scores;
create policy scores_read on public.drill_scores
  for select using (is_coach() or student_id in (select my_students()));

drop policy if exists scores_insert on public.drill_scores;
create policy scores_insert on public.drill_scores
  for insert with check (
    is_coach()
    or (student_id in (select my_students())
        and exists (select 1 from entries d where d.id = drill_id and d.student_id = drill_scores.student_id and d.type = 'drill'))
  );

drop policy if exists scores_delete on public.drill_scores;
create policy scores_delete on public.drill_scores
  for delete using (is_coach() or created_by = auth.uid());

-- Students read their own profile without the coach-only notes.
create or replace view public.students_public with (security_invoker = false) as
  select id, name, grp, handicap, program, start_date, next_lesson, goals
  from public.students
  where not archived and (is_coach() or id in (select my_students()));
grant select on public.students_public to authenticated;

-- Live updates for the app.
do $$
begin
  begin
    alter publication supabase_realtime add table public.entries;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.drill_scores;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------
-- The coach account
-- ---------------------------------------------------------------
insert into public.coach_emails (email) values ('karina@karinagolfcoaching.com')
  on conflict do nothing;
