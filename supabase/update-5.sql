-- Update 5 · alert emails can no longer be aimed at arbitrary addresses.
-- Run in Supabase → SQL Editor after notify.sql. Safe to re-run.
--
-- Before: the database told /api/notify who to email, and /api/notify trusted it, so anyone who learned
-- the shared secret could send email from hub@karinagolfcoaching.com to any address with any text.
-- Now: the database only sends the id of the new entry. /api/notify asks the database (with the secret)
-- for the real recipients and text of that entry, so the secret can only re-send emails that already exist.

create or replace function public.notify_payload(p_secret text, p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  s text;
  e record;
  st record;
  dir text;
  rcpt jsonb := '[]'::jsonb;
begin
  select value into s from private.settings where key = 'notify_secret';
  if s is null or s = 'PASTE_NOTIFY_SECRET' or p_secret is distinct from s then return null; end if;

  select id, student_id, type, author, data into e from entries where id = p_entry;
  if not found then return null; end if;

  if e.author = 'student' and e.type in ('note', 'stat', 'session', 'goal') then
    dir := 'to_coach';
  elsif e.author = 'coach' and e.type in ('note', 'lesson') then
    dir := 'to_student';
  else
    return null;
  end if;

  select name, email, guardian_email, archived into st from students where id = e.student_id;
  if dir = 'to_student' then
    if st.archived then return null; end if;
    select coalesce(jsonb_agg(distinct lower(x)), '[]'::jsonb) into rcpt
      from unnest(array[st.email, st.guardian_email]) as x where x is not null and x <> '';
    if jsonb_array_length(rcpt) = 0 then return null; end if;
  end if;

  return jsonb_build_object('direction', dir, 'type', e.type, 'student_name', st.name, 'recipients', rcpt, 'data', e.data);
end $$;

-- Only the app's server function (which uses the public key plus the secret) can call it.
revoke all on function public.notify_payload(text, uuid) from public;
grant execute on function public.notify_payload(text, uuid) to anon, authenticated;

-- The trigger now sends just the entry id.
create or replace function public.notify_coach() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  u text;
  s text;
begin
  if not ((new.author = 'student' and new.type in ('note', 'stat', 'session', 'goal'))
       or (new.author = 'coach' and new.type in ('note', 'lesson'))) then
    return new;
  end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then
    return new;
  end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('entry_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Never block a post because an email failed.
  return new;
end $$;

-- Same for the goal-changed email.
create or replace function public.notify_goal_update() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  u text; s text;
begin
  if is_coach() or new.type <> 'goal'
     or (coalesce(old.data->'m3', 'null') = coalesce(new.data->'m3', 'null') and coalesce(old.data->'m6', 'null') = coalesce(new.data->'m6', 'null')) then
    return new;
  end if;
  select value into u from private.settings where key = 'notify_url';
  select value into s from private.settings where key = 'notify_secret';
  if u is null or s is null or s = 'PASTE_NOTIFY_SECRET' then return new; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('entry_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
    timeout_milliseconds := 5000);
  return new;
exception when others then return new;
end $$;
