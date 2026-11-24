-- STUNER weekly class timetable.
-- Applied to the connected STUNER Supabase project on 2026-11-24.

create table public.school_weekly_schedule (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null references public.school_classes(id) on delete cascade,
 weekday smallint not null check (weekday between 0 and 6),
 start_time time not null,
 end_time time not null,
 subject text not null check (length(trim(subject)) between 1 and 150),
 teacher_name text not null default '',
 room text not null default '',
 created_at timestamptz not null default now(),
 constraint school_weekly_schedule_time_check check (end_time > start_time)
);
create index school_weekly_schedule_school_class_day_idx
 on public.school_weekly_schedule (school_id, class_id, weekday, start_time);
alter table public.school_weekly_schedule enable row level security;
revoke all on public.school_weekly_schedule from anon, authenticated;
grant select on public.school_weekly_schedule to authenticated;
create policy "weekly schedule visible to school members"
 on public.school_weekly_schedule for select to authenticated
 using (private.is_member(school_id));

create or replace function public.publish_school_weekly_schedule(p_school_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_row jsonb;
 v_class uuid;
 v_day integer;
 v_start text;
 v_end text;
 v_subject text;
 v_count integer;
begin
 if auth.uid() is null or not private.is_principal(p_school_id) then
  raise exception 'Access denied';
 end if;
 if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then
  raise exception 'فایل باید حداقل یک و حداکثر ۱۰۰۰ ردیف برنامه داشته باشد.';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  begin
   v_class := (v_row->>'class_id')::uuid;
   v_day := (v_row->>'weekday')::integer;
  exception when others then
   raise exception 'کلاس یا روز یکی از ردیف‌ها معتبر نیست.';
  end;
  v_start := coalesce(v_row->>'start_time','');
  v_end := coalesce(v_row->>'end_time','');
  v_subject := trim(coalesce(v_row->>'subject',''));
  if not exists(select 1 from public.school_classes c where c.id=v_class and c.school_id=p_school_id) then
   raise exception 'یکی از کلاس‌های فایل در این مدرسه وجود ندارد.';
  end if;
  if v_day < 0 or v_day > 6 or v_subject = '' or
     v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
     v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
     v_end <= v_start then
   raise exception 'روز، ساعت یا نام درس در یکی از ردیف‌ها معتبر نیست.';
  end if;
 end loop;
 delete from public.school_weekly_schedule where school_id=p_school_id;
 insert into public.school_weekly_schedule
  (school_id,class_id,weekday,start_time,end_time,subject,teacher_name,room)
 select p_school_id,
        (item->>'class_id')::uuid,
        (item->>'weekday')::smallint,
        (item->>'start_time')::time,
        (item->>'end_time')::time,
        trim(item->>'subject'),
        coalesce(item->>'teacher_name',''),
        coalesce(item->>'room','')
 from jsonb_array_elements(p_rows) as rows(item);
 get diagnostics v_count = row_count;
 return v_count;
end;
$$;
revoke all on function public.publish_school_weekly_schedule(uuid,jsonb) from public, anon;
grant execute on function public.publish_school_weekly_schedule(uuid,jsonb) to authenticated;
