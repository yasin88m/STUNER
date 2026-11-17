-- Classroom work, applied to STUNER Supabase project oaknqlkvagjjjloytmau.
-- A teacher may publish homework/exams only to classes assigned by the principal.
-- Students see only assignments addressed to their class and manage their own completion.

create table if not exists public.school_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null references public.school_classes(id) on delete cascade,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check (kind in ('task','exam')),
 title text not null check (char_length(trim(title)) between 2 and 150),
 subject text not null check (char_length(trim(subject)) between 1 and 100),
 description text not null default '' check (char_length(description) <= 3000),
 due_date date not null,
 created_at timestamptz not null default now()
);
create table if not exists public.assignment_completions (
 assignment_id uuid not null references public.school_assignments(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 completed_at timestamptz not null default now(),
 primary key (assignment_id, student_id)
);
create index if not exists school_assignments_class_due_idx on public.school_assignments(class_id, due_date);
create index if not exists school_assignments_teacher_idx on public.school_assignments(teacher_id);
create index if not exists school_assignments_school_idx on public.school_assignments(school_id);
create index if not exists assignment_completions_student_idx on public.assignment_completions(student_id);
create or replace function private.student_in_class(s uuid, c uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
 select 1 from public.school_memberships m
 where m.user_id=(select auth.uid()) and m.school_id=s and m.class_id=c and m.role='student'
 )
$$;
revoke all on function private.student_in_class(uuid,uuid) from public,anon;
grant execute on function private.student_in_class(uuid,uuid) to authenticated;
alter table public.school_assignments enable row level security;
alter table public.assignment_completions enable row level security;
revoke all on public.school_assignments,public.assignment_completions from anon;
grant select,insert,update,delete on public.school_assignments to authenticated;
grant select,insert,delete on public.assignment_completions to authenticated;
create policy "assignment audience select" on public.school_assignments
 for select to authenticated using (
  private.is_principal(school_id)
  or (teacher_id=(select auth.uid()) and private.is_teacher_of(class_id))
  or private.student_in_class(school_id,class_id)
 );
create policy "assigned teacher creates class work" on public.school_assignments
 for insert to authenticated with check (
  teacher_id=(select auth.uid())
  and private.is_teacher_of(class_id)
  and exists(select 1 from public.school_classes c where c.id=class_id and c.school_id=school_assignments.school_id)
 );
create policy "assigned teacher edits class work" on public.school_assignments
 for update to authenticated
 using (teacher_id=(select auth.uid()) and private.is_teacher_of(class_id))
 with check (
  teacher_id=(select auth.uid()) and private.is_teacher_of(class_id)
  and exists(select 1 from public.school_classes c where c.id=class_id and c.school_id=school_assignments.school_id)
 );
create policy "assigned teacher deletes class work" on public.school_assignments
 for delete to authenticated using (teacher_id=(select auth.uid()) and private.is_teacher_of(class_id));
create policy "student sees own completion" on public.assignment_completions
 for select to authenticated using (student_id=(select auth.uid()));
create policy "student marks assigned task done" on public.assignment_completions
 for insert to authenticated with check (
  student_id=(select auth.uid()) and exists(
   select 1 from public.school_assignments a where a.id=assignment_id
    and a.kind='task' and private.student_in_class(a.school_id,a.class_id)
  )
 );
create policy "student reopens assigned task" on public.assignment_completions
 for delete to authenticated using (
  student_id=(select auth.uid()) and exists(
   select 1 from public.school_assignments a where a.id=assignment_id
    and a.kind='task' and private.student_in_class(a.school_id,a.class_id)
  )
 );
