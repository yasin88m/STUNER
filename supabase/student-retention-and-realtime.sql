-- STUNER retention, realtime grade alerts, and query performance.
-- Keep only the most recent seven days of teacher-assigned tasks.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create index if not exists school_assignments_kind_created_at_idx
  on public.school_assignments (kind, created_at);
create index if not exists school_assignments_school_class_due_idx
  on public.school_assignments (school_id, class_id, due_date);
create index if not exists school_assignments_school_student_due_idx
  on public.school_assignments (school_id, student_id, due_date)
  where student_id is not null;
create index if not exists school_student_grades_student_date_idx
  on public.school_student_grades (school_id, class_id, student_id, graded_on desc);

-- Realtime grade updates let a student's open session receive a new grade notice.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'school_student_grades'
  ) then
    execute 'alter publication supabase_realtime add table public.school_student_grades';
  end if;
end
$$;

-- Apply the retention rule immediately to already-expired tasks.
delete from public.school_assignments
where kind = 'task'
  and created_at < now() - interval '7 days';

-- Run the cleanup once per hour. Projects and exams are intentionally retained.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'stuner-purge-expired-tasks'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'stuner-purge-expired-tasks',
    '0 * * * *',
    $job$
      delete from public.school_assignments
      where kind = 'task'
        and created_at < now() - interval '7 days';
    $job$
  );
end
$$;
