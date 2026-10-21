-- Update 5: pictures and PDFs attached to notes
-- Supabase → SQL Editor → New query → paste → Run. Safe to run again. No values to replace.
--
-- Files go in a private bucket called practice-files, in a folder named after the student's id.
-- Karina can read and add files for every student. A student (or parent) can read and add files
-- only in their own student's folder, the same people who can see that student's notes.

insert into storage.buckets (id, name, public, file_size_limit)
values ('practice-files', 'practice-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists practice_files_read on storage.objects;
create policy practice_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'practice-files'
         and (is_coach() or split_part(name, '/', 1) in (select my_students()::text)));

drop policy if exists practice_files_add on storage.objects;
create policy practice_files_add on storage.objects
  for insert to authenticated
  with check (bucket_id = 'practice-files'
              and (is_coach() or split_part(name, '/', 1) in (select my_students()::text)));

-- Only Karina removes files (when she deletes the note they belong to).
drop policy if exists practice_files_delete on storage.objects;
create policy practice_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'practice-files' and is_coach());
