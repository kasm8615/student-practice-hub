-- Golfers Practice Hub · update 8: sort Karina's student list by latest upload
-- Supabase → SQL Editor → New query → paste → Run. Safe to run again. No values to replace.
--
-- For each student Karina can see: when they last posted something (a round, practice, note,
-- swing video, goals, shot pattern, club distances or a drill score) and what it was.

create or replace function public.last_activity_by_student()
returns table (student_id uuid, last_post timestamptz, last_type text)
language sql stable security definer set search_path = public as $$
  select distinct on (x.student_id) x.student_id, x.at, x.kind
  from (
    select e.student_id,
           case when e.type = 'bag' then e.updated_at else e.created_at end as at,
           case when e.type = 'note' and coalesce(e.data->>'video_pid', '') <> '' then 'video' else e.type end as kind
      from entries e
     where e.author = 'student'
    union all
    select d.student_id, d.created_at, 'score'
      from drill_scores d
     where d.created_by is not null and d.created_by not in (select user_id from coaches)
  ) x
  where coach_can(x.student_id)
  order by x.student_id, x.at desc;
$$;
