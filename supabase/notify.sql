-- Golfers Practice Hub · emails when a student posts (to the coach) and when the coach posts (to the student)
-- Run in Supabase → SQL Editor after schema.sql. Safe to re-run.
-- Replace PASTE_NOTIFY_SECRET with the same value you saved in Cloudflare as NOTIFY_SECRET.

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.settings (
  key text primary key,
  value text not null
);
insert into private.settings (key, value) values
  ('notify_url', 'https://app.karinagolfcoaching.com/api/notify'),
  ('notify_secret', 'PASTE_NOTIFY_SECRET')
on conflict (key) do update set value = excluded.value;

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
