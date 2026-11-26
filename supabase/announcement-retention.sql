-- STUNER: retain school announcements for seven days only.
-- Run this script once in the Supabase SQL Editor.
-- This affects ONLY public.school_announcements; assignments, grades,
-- weekly schedules, student records and accounts are not modified.

create extension if not exists pg_cron with schema extensions;

-- Remove any previous job with this name so the script is safe to re-run.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname = 'stuner-delete-expired-announcements'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

-- Clean up announcements that have already exceeded the seven-day window.
delete from public.school_announcements
where created_at < now() - interval '7 days';

-- Keep the database clean automatically, checking once every hour.
select cron.schedule(
  'stuner-delete-expired-announcements',
  '0 * * * *',
  $job$
    delete from public.school_announcements
    where created_at < now() - interval '7 days';
  $job$
);
