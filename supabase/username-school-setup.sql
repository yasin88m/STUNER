
-- Apply after supabase/schema.sql on another STUNER Supabase project.
-- Already deployed and validated in project oaknqlkvagjjjloytmau.
alter table public.schools add column if not exists branch text;
alter table public.schools add column if not exists majors text[] not null default '{}'::text[];
alter table public.schools add column if not exists grades text[] not null default '{}'::text[];
alter table public.school_classes add column if not exists major text;
create table if not exists public.account_usernames(
 username text primary key check(username ~ '^[a-z][a-z0-9_]{3,31}$'),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.account_usernames enable row level security;
revoke all on public.account_usernames from anon;
grant select on public.account_usernames to authenticated;
drop policy if exists "Members see own username and managers see their school users" on public.account_usernames;
create policy "Members see own username and managers see their school users"
 on public.account_usernames for select to authenticated
 using(user_id = (select auth.uid()) or exists(
   select 1 from public.school_memberships m
   where m.user_id=account_usernames.user_id and private.is_principal(m.school_id)
 ));
create index if not exists school_classes_school_major_idx on public.school_classes(school_id,grade,major);
create table if not exists public.manager_registration_attempts (
 id uuid primary key default gen_random_uuid(),
 fingerprint text not null check(char_length(fingerprint)=64),
 attempted_at timestamptz not null default now()
);
create index if not exists manager_registration_fingerprint_time_idx on public.manager_registration_attempts(fingerprint,attempted_at desc);
alter table public.manager_registration_attempts enable row level security;
revoke all on public.manager_registration_attempts from anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_school_with_classes(p_name text, p_kind text, p_branch text, p_manager text, p_grades text[], p_majors text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_school uuid; v_grade text; v_major text; v_grades text[];v_majors text[];
begin
 if auth.uid() is null then raise exception 'Login required';end if;
 if p_kind not in ('elementary','middle','secondary','vocational')
 or length(trim(coalesce(p_name,''))) not between 3 and 160
 or length(trim(coalesce(p_manager,''))) not between 2 and 120
 then raise exception 'Invalid school';end if;
 if p_kind='vocational' and p_branch not in ('فنی‌وحرفه‌ای','کاردانش')
 then raise exception 'Vocational branch is required';end if;
 if p_kind='secondary' and p_branch is distinct from 'نظری'
 then raise exception 'Theoretical branch is required';end if;
 if p_kind in ('elementary','middle') and coalesce(p_branch,'')<>'' then raise exception 'Branch not applicable';end if;
 select array_agg(trim(x) order by ord) into v_grades
 from (select distinct on (trim(x)) x,ord from unnest(p_grades) with ordinality g(x,ord)
 where length(trim(coalesce(x,''))) between 2 and 40 order by trim(x),ord) z;
 select array_agg(trim(x) order by ord) into v_majors
 from (select distinct on (trim(x)) x,ord from unnest(p_majors) with ordinality g(x,ord)
 where length(trim(coalesce(x,''))) between 2 and 90 order by trim(x),ord) z;
 if coalesce(array_length(v_grades,1),0) not between 1 and 12 or
 coalesce(array_length(v_majors,1),0)>40 then raise exception 'Invalid grade / major count';end if;
 if p_kind in ('vocational','secondary') and coalesce(array_length(v_majors,1),0)=0
 then raise exception 'At least one major is required';end if;
 if p_kind in ('elementary','middle') and coalesce(array_length(v_majors,1),0)>0
 then raise exception 'Majors are not used at this level';end if;
 if exists(select 1 from unnest(v_grades) g where
  (p_kind='elementary' and g not in ('اول','دوم','سوم','چهارم','پنجم','ششم'))
  or (p_kind='middle' and g not in ('هفتم','هشتم','نهم'))
  or (p_kind in ('secondary','vocational') and g not in ('دهم','یازدهم','دوازدهم')))
 then raise exception 'Grade is incompatible with school';end if;
 insert into public.schools(name,kind,branch,grades,majors,created_by)
 values(trim(p_name),p_kind,nullif(trim(coalesce(p_branch,'')),''),v_grades,coalesce(v_majors,'{}'::text[]),auth.uid())
 returning id into v_school;
 insert into public.school_memberships(school_id,user_id,role,display_name)
 values(v_school,auth.uid(),'principal',trim(p_manager));
 foreach v_grade in array v_grades loop
  if coalesce(array_length(v_majors,1),0)>0 then
   foreach v_major in array v_majors loop
    insert into public.school_classes(school_id,name,grade,major)
    values(v_school,v_grade||' - '||v_major,v_grade,v_major);
   end loop;
  else
   insert into public.school_classes(school_id,name,grade)
   values(v_school,'پایه '||v_grade,v_grade);
  end if;
 end loop;
 return v_school;
end $function$

revoke all on function public.create_school_with_classes(text,text,text,text,text[],text[]) from public,anon;
grant execute on function public.create_school_with_classes(text,text,text,text,text[],text[]) to authenticated;
