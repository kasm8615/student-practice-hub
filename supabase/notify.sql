-- Student Practice Hub · email the coach when a student posts
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
  n text;
begin
  if new.author <> 'student' or new.type not in ('note', 'stat') then
    return new;
  end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  select name into n from students where id = new.student_id;
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then
    return new;
  end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('type', new.type, 'student_name', n, 'data', new.data),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never block a student's post because an email failed.
  return new;
end $$;

drop trigger if exists on_student_post on public.entries;
create trigger on_student_post
  after insert on public.entries
  for each row execute function public.notify_coach();
