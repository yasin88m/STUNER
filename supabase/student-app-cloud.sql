-- Personal student app data: cloud-backed, scoped to the signed-in student and school.
-- Classroom homework/exams remain in school_assignments / assignment_completions.
create table if not exists public.student_app_states (
 school_id uuid not null references public.schools(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
 revision bigint not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now(),
 primary key (school_id, student_id)
);
create index if not exists student_app_states_student_idx on public.student_app_states(student_id);
alter table public.student_app_states enable row level security;
revoke all on public.student_app_states from anon;
grant select, insert, update on public.student_app_states to authenticated;

create policy "student app state select own school"
 on public.student_app_states for select to authenticated
 using (
  student_id = (select auth.uid())
  and exists (select 1 from public.school_memberships m
   where m.user_id = student_id and m.school_id = student_app_states.school_id and m.role = 'student')
 );
create policy "student app state create own school"
 on public.student_app_states for insert to authenticated
 with check (
  student_id = (select auth.uid())
  and exists (select 1 from public.school_memberships m
   where m.user_id = student_id and m.school_id = student_app_states.school_id and m.role = 'student')
 );
create policy "student app state update own school"
 on public.student_app_states for update to authenticated
 using (
  student_id = (select auth.uid())
  and exists (select 1 from public.school_memberships m
   where m.user_id = student_id and m.school_id = student_app_states.school_id and m.role = 'student')
 )
 with check (
  student_id = (select auth.uid())
  and exists (select 1 from public.school_memberships m
   where m.user_id = student_id and m.school_id = student_app_states.school_id and m.role = 'student')
 );
