-- STUNER project assignments and private file submissions.
-- Run once in the Supabase SQL Editor. Existing tasks/exams remain unchanged.

-- Support assignments targeted to one student while retaining the student's class context.
alter table public.school_assignments add column if not exists student_id uuid references auth.users(id) on delete cascade;

alter table public.school_assignments
  drop constraint if exists school_assignments_kind_check;
alter table public.school_assignments
  add constraint school_assignments_kind_check
  check (kind in ('task','exam','project'));

-- Validate individual targets against the teacher's assigned class.
drop policy if exists "assigned teacher creates class work" on public.school_assignments;
create policy "assigned teacher creates class work" on public.school_assignments
 for insert to authenticated with check (
  teacher_id=(select auth.uid())
  and private.is_teacher_of(class_id)
  and exists(select 1 from public.school_classes c where c.id=class_id and c.school_id=school_assignments.school_id)
  and (
   student_id is null or exists(
    select 1 from public.school_memberships m
    where m.school_id=school_assignments.school_id and m.class_id=school_assignments.class_id
      and m.user_id=school_assignments.student_id and m.role='student'
   )
  )
 );
drop policy if exists "assigned teacher edits class work" on public.school_assignments;
create policy "assigned teacher edits class work" on public.school_assignments
 for update to authenticated using (teacher_id=(select auth.uid()) and private.is_teacher_of(class_id))
 with check (
  teacher_id=(select auth.uid()) and private.is_teacher_of(class_id)
  and exists(select 1 from public.school_classes c where c.id=class_id and c.school_id=school_assignments.school_id)
  and (
   student_id is null or exists(
    select 1 from public.school_memberships m
    where m.school_id=school_assignments.school_id and m.class_id=school_assignments.class_id
      and m.user_id=school_assignments.student_id and m.role='student'
   )
  )
 );

-- Restrict individual assignments to their selected student, not the whole class.
drop policy if exists "assignment audience select" on public.school_assignments;
create policy "assignment audience select" on public.school_assignments
 for select to authenticated using (
  private.is_principal(school_id)
  or (teacher_id=(select auth.uid()) and private.is_teacher_of(class_id))
  or (
    private.student_in_class(school_id,class_id)
    and (student_id is null or student_id=(select auth.uid()))
  )
 );

create table if not exists public.project_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.school_assignments(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 file_name text not null check (char_length(file_name) between 1 and 255),
 file_path text not null unique,
 file_size bigint not null check (file_size > 0 and file_size <= 52428800),
 mime_type text not null default 'application/octet-stream',
 submitted_at timestamptz not null default now(),
 unique (assignment_id,student_id)
);
create index if not exists project_submissions_assignment_idx
 on public.project_submissions(assignment_id);
create index if not exists project_submissions_student_idx
 on public.project_submissions(student_id);

alter table public.project_submissions enable row level security;
revoke all on public.project_submissions from anon;
grant select,insert,update on public.project_submissions to authenticated;

drop policy if exists "project submission audience read" on public.project_submissions;
create policy "project submission audience read" on public.project_submissions
 for select to authenticated using (
  student_id=(select auth.uid())
  or exists(
   select 1 from public.school_assignments a
   where a.id=project_submissions.assignment_id
     and a.teacher_id=(select auth.uid())
     and private.is_teacher_of(a.class_id)
  )
 );
drop policy if exists "student submits own project" on public.project_submissions;
create policy "student submits own project" on public.project_submissions
 for insert to authenticated with check (
  student_id=(select auth.uid())
  and exists(
   select 1 from public.school_assignments a
   where a.id=project_submissions.assignment_id and a.kind='project'
     and (a.student_id is null or a.student_id=(select auth.uid()))
     and private.student_in_class(a.school_id,a.class_id)
  )
 );
drop policy if exists "student replaces own project submission" on public.project_submissions;
create policy "student replaces own project submission" on public.project_submissions
 for update to authenticated using (student_id=(select auth.uid()))
 with check (
  student_id=(select auth.uid())
  and exists(
   select 1 from public.school_assignments a
   where a.id=project_submissions.assignment_id and a.kind='project'
     and (a.student_id is null or a.student_id=(select auth.uid()))
     and private.student_in_class(a.school_id,a.class_id)
  )
 );

-- Private bucket: files are never publicly addressable.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
 'stuner-project-submissions',
 'stuner-project-submissions',
 false,
 52428800,
 array[
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
  'application/octet-stream'
 ]
)
on conflict(id) do update set
 public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "student uploads own project file" on storage.objects;
create policy "student uploads own project file" on storage.objects
 for insert to authenticated with check (
  bucket_id='stuner-project-submissions'
  and split_part(name,'/',2)=(select auth.uid())::text
  and exists(
   select 1 from public.school_assignments a
   where a.id::text=split_part(name,'/',1)
     and a.kind='project'
     and (a.student_id is null or a.student_id=(select auth.uid()))
     and private.student_in_class(a.school_id,a.class_id)
  )
 );

drop policy if exists "project participants read files" on storage.objects;
create policy "project participants read files" on storage.objects
 for select to authenticated using (
  bucket_id='stuner-project-submissions'
  and (
   split_part(name,'/',2)=(select auth.uid())::text
   or exists(
    select 1 from public.school_assignments a
    where a.id::text=split_part(name,'/',1)
      and a.kind='project'
      and a.teacher_id=(select auth.uid())
      and private.is_teacher_of(a.class_id)
   )
  )
 );

drop policy if exists "student deletes own project file" on storage.objects;
create policy "student deletes own project file" on storage.objects
 for delete to authenticated using (
  bucket_id='stuner-project-submissions'
  and split_part(name,'/',2)=(select auth.uid())::text
 );
