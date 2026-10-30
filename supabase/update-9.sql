-- Golfers Practice Hub · update 9: tighter permissions on the app's database functions
-- Supabase → SQL Editor → New query → paste → Run. Safe to run again. No values to replace.
--
-- Before: every function could be called by anyone, even without signing in. Each one already checked
-- who was asking, so nothing leaked, but this closes the door completely:
--   • Not signed in (anon): can call none of them.
--   • Signed in: only the ones the app uses, plus the three that the privacy rules rely on.
--   • Trigger functions (sign-up, stamping, emails) can't be called directly by anyone; the database
--     still runs them automatically.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_coach(), public.my_students(), public.coach_can(uuid),
  public.whoami(), public.touch_seen(), public.set_plan_done(uuid, boolean), public.last_seen_by_student(),
  public.set_sharing(uuid, boolean), public.request_coaching(uuid, text), public.delete_practice_account(uuid),
  public.practice_summary(), public.last_activity_by_student()
  to authenticated;

-- Functions added in future updates start closed too.
alter default privileges in schema public revoke execute on functions from public, anon;
