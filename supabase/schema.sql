
-- STUNER / multi-school database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
create table public.schools(
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 3 and 160),
 kind text not null check(kind in ('elementary','middle','secondary','vocational')),
 created_by uuid not null references auth.users(id),created_at timestamptz default now()
);
create table public.school_classes(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,
 name text not null,grade text not null,unique(school_id,name)
);
create table public.school_memberships(
 school_id uuid not null references public.schools(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('student','teacher','principal')),
 display_name text not null,grade text,class_id uuid references public.school_classes(id) on delete set null,
 primary key(school_id,user_id)
);
create table public.class_teachers(
 school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null references public.school_classes(id) on delete cascade,
 teacher_id uuid not null references auth.users(id) on delete cascade,
 primary key(class_id,teacher_id)
);
create table public.school_invites(
 school_id uuid not null references public.schools(id) on delete cascade,
 email text not null,display_name text not null,role text not null check(role in ('student','teacher')),
 grade text,class_id uuid references public.school_classes(id),token_hash bytea primary key,
 expires_at timestamptz not null default(now()+interval '14 days'),redeemed boolean not null default false
);
create index on public.school_memberships(user_id);
create or replace function private.is_member(s uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_memberships m where m.school_id=s and m.user_id=(select auth.uid())) $$;
create or replace function private.is_principal(s uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.school_memberships m where m.school_id=s and m.user_id=(select auth.uid()) and m.role='principal') $$;
create or replace function private.is_teacher_of(c uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.class_teachers t where t.class_id=c and t.teacher_id=(select auth.uid())) $$;
revoke all on function private.is_member(uuid),private.is_principal(uuid),private.is_teacher_of(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid),private.is_principal(uuid),private.is_teacher_of(uuid) to authenticated;
alter table public.schools enable row level security;
alter table public.school_classes enable row level security;
alter table public.school_memberships enable row level security;
alter table public.class_teachers enable row level security;
alter table public.school_invites enable row level security;
revoke all on public.schools,public.school_classes,public.school_memberships,public.class_teachers,public.school_invites from anon;
grant select on public.schools,public.school_classes,public.school_memberships,public.class_teachers to authenticated;
grant insert on public.school_classes,public.class_teachers to authenticated;
create policy "schools member read" on public.schools for select to authenticated using(private.is_member(id));
create policy "classes member read" on public.school_classes for select to authenticated using(private.is_member(school_id));
create policy "classes principal create" on public.school_classes for insert to authenticated with check(private.is_principal(school_id));
create policy "members read permitted" on public.school_memberships for select to authenticated using(
 user_id=(select auth.uid()) or private.is_principal(school_id)
 or (role='student' and class_id is not null and private.is_teacher_of(class_id))
);
create policy "teachers assigned read" on public.class_teachers for select to authenticated using(
 private.is_principal(school_id) or teacher_id=(select auth.uid())
);
create policy "teachers assigned create" on public.class_teachers for insert to authenticated with check(
 private.is_principal(school_id) and
 exists(select 1 from public.school_classes c where c.school_id=class_teachers.school_id and c.id=class_id) and
 exists(select 1 from public.school_memberships m where m.school_id=class_teachers.school_id and m.user_id=teacher_id and m.role='teacher')
);
create or replace function public.create_school(p_name text,p_kind text,p_manager text)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if auth.uid() is null then raise exception 'Login required';end if;
 if p_kind not in ('elementary','middle','secondary','vocational') or
 length(trim(coalesce(p_name,''))) not between 3 and 160 or
 length(trim(coalesce(p_manager,''))) not between 2 and 120 then raise exception 'Invalid school';end if;
 insert into public.schools(name,kind,created_by) values(trim(p_name),p_kind,auth.uid()) returning id into sid;
 insert into public.school_memberships(school_id,user_id,role,display_name) values(sid,auth.uid(),'principal',trim(p_manager));
 return sid;
end $$;
create or replace function public.create_school_invite(
 p_school uuid,p_email text,p_name text,p_role text,p_grade text default null,p_class uuid default null
)returns text language plpgsql security definer set search_path='' as $$
declare code text;g text;
begin
 if auth.uid() is null or not private.is_principal(p_school) then raise exception 'Access denied';end if;
 if p_role not in ('student','teacher') or position('@' in coalesce(p_email,''))<2
 or length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Invalid invitation';end if;
 g:=nullif(trim(coalesce(p_grade,'')),'');
 if (p_role='student' and g is null) or (p_role='teacher' and g is not null) then raise exception 'Invalid grade';end if;
 if p_class is not null and not exists(select 1 from public.school_classes c where c.id=p_class and c.school_id=p_school
 and (p_role='teacher' or c.grade=g)) then raise exception 'Class mismatch';end if;
 code:=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.school_invites(school_id,email,display_name,role,grade,class_id,token_hash)
 values(p_school,lower(trim(p_email)),trim(p_name),p_role,g,p_class,extensions.digest(code,'sha256'));
 return code;
end $$;
create or replace function public.redeem_school_invite(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.school_invites%rowtype; em text;uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Login required';end if;
 if p_token !~ '^[0-9a-f]{48}$' then raise exception 'Invalid invite code';end if;
 select lower(email) into em from auth.users where id=uid;
 select * into inv from public.school_invites where token_hash=extensions.digest(p_token,'sha256')
 and redeemed=false and expires_at>now() for update;
 if not found or inv.email is distinct from em then raise exception 'Code expired or email does not match';end if;
 insert into public.school_memberships(school_id,user_id,role,display_name,grade,class_id)
 values(inv.school_id,uid,inv.role,inv.display_name,inv.grade,inv.class_id);
 if inv.role='teacher' and inv.class_id is not null then
 insert into public.class_teachers(school_id,class_id,teacher_id)values(inv.school_id,inv.class_id,uid);end if;
 update public.school_invites set redeemed=true where token_hash=inv.token_hash;
 return inv.school_id;
end $$;
revoke all on function public.create_school(text,text,text),public.create_school_invite(uuid,text,text,text,text,uuid),
public.redeem_school_invite(text) from public,anon;
grant execute on function public.create_school(text,text,text),public.create_school_invite(uuid,text,text,text,text,uuid),
public.redeem_school_invite(text) to authenticated;
