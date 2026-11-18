-- STUNER school database onboarding and secure deletion. Already applied to live project.
-- Apply through Supabase SQL editor when provisioning a new instance.

CREATE OR REPLACE FUNCTION public.create_school_from_database(p_name text, p_kind text, p_branch text, p_manager text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_school uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
 IF p_kind NOT IN ('elementary','middle','secondary','vocational') OR
    length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 160 OR
    length(trim(coalesce(p_manager,''))) NOT BETWEEN 2 AND 120 THEN
   RAISE EXCEPTION 'Invalid school'; END IF;
 IF p_kind='vocational' AND p_branch NOT IN ('فنی‌وحرفه‌ای','کاردانش') THEN
   RAISE EXCEPTION 'Vocational branch required'; END IF;
 IF p_kind='secondary' AND p_branch IS DISTINCT FROM 'نظری' THEN
   RAISE EXCEPTION 'Secondary branch required'; END IF;
 IF p_kind IN ('elementary','middle') AND coalesce(p_branch,'')<>'' THEN
   RAISE EXCEPTION 'Branch not applicable'; END IF;
 INSERT INTO public.schools(name,kind,branch,grades,majors,created_by)
 VALUES(trim(p_name),p_kind,nullif(trim(coalesce(p_branch,'')),''),'{}'::text[],'{}'::text[],auth.uid())
 RETURNING id INTO v_school;
 INSERT INTO public.school_memberships(school_id,user_id,role,display_name)
 VALUES(v_school,auth.uid(),'principal',trim(p_manager));
 RETURN v_school;
END
$function$

REVOKE ALL ON FUNCTION public.create_school_from_database(text,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.create_school_from_database(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_school_records(p_school uuid, p_actor uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_school public.schools%ROWTYPE; v_users uuid[]; v_n_members integer;
BEGIN
 SELECT * INTO v_school FROM public.schools WHERE id=p_school FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'School not found'; END IF;
 IF v_school.created_by IS DISTINCT FROM p_actor
  OR NOT EXISTS(SELECT 1 FROM public.school_memberships
     WHERE school_id=p_school AND user_id=p_actor AND role='principal')
 THEN RAISE EXCEPTION 'Only the school creator and principal may delete the school'; END IF;
 IF p_confirmation IS DISTINCT FROM v_school.name THEN
   RAISE EXCEPTION 'School name confirmation mismatch'; END IF;
 SELECT count(*) INTO v_n_members FROM public.school_memberships WHERE school_id=p_school AND role IN ('student','teacher');
 SELECT coalesce(array_agg(m.user_id),'{}'::uuid[]) INTO v_users
 FROM public.school_memberships m
 WHERE m.school_id=p_school AND m.role IN ('student','teacher')
 AND NOT EXISTS(SELECT 1 FROM public.school_memberships other
    WHERE other.user_id=m.user_id AND other.school_id<>p_school)
 AND NOT EXISTS(SELECT 1 FROM public.schools other WHERE other.created_by=m.user_id AND other.id<>p_school)
 AND NOT EXISTS(SELECT 1 FROM public.school_assignments other WHERE other.teacher_id=m.user_id AND other.school_id<>p_school)
 AND NOT EXISTS(SELECT 1 FROM public.class_teachers other WHERE other.teacher_id=m.user_id AND other.school_id<>p_school);
 DELETE FROM public.assignment_completions c
 USING public.school_assignments a WHERE c.assignment_id=a.id AND a.school_id=p_school;
 DELETE FROM public.school_assignments WHERE school_id=p_school;
 DELETE FROM public.class_teachers WHERE school_id=p_school;
 DELETE FROM public.school_invites WHERE school_id=p_school;
 DELETE FROM public.school_memberships WHERE school_id=p_school;
 DELETE FROM public.school_classes WHERE school_id=p_school;
 DELETE FROM public.schools WHERE id=p_school;
 RETURN jsonb_build_object('deleted_school',p_school,'member_count',v_n_members,'orphan_users',to_jsonb(v_users));
END
$function$

REVOKE ALL ON FUNCTION public.delete_school_records(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.delete_school_records(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_school_import_structure(p_school uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_kind text; v_grades text[]; v_majors text[];
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.school_memberships
  WHERE school_id=p_school AND user_id=auth.uid() AND role='principal'
 ) THEN RAISE EXCEPTION 'Principal authorization required'; END IF;
 SELECT kind INTO v_kind FROM public.schools WHERE id=p_school FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'School not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.school_classes WHERE school_id=p_school
  AND (length(trim(grade)) NOT BETWEEN 2 AND 40
  OR (v_kind='elementary' AND grade NOT IN ('اول','دوم','سوم','چهارم','پنجم','ششم'))
  OR (v_kind='middle' AND grade NOT IN ('هفتم','هشتم','نهم'))
  OR (v_kind IN ('secondary','vocational') AND grade NOT IN ('دهم','یازدهم','دوازدهم'))
  OR length(trim(coalesce(major,'')))>90)
 ) THEN RAISE EXCEPTION 'Invalid grade or major in imported classes'; END IF;
 SELECT coalesce(array_agg(DISTINCT grade ORDER BY grade),'{}'::text[])
 INTO v_grades FROM public.school_classes WHERE school_id=p_school;
 SELECT coalesce(array_agg(DISTINCT major ORDER BY major),'{}'::text[])
 INTO v_majors FROM public.school_classes WHERE school_id=p_school AND nullif(trim(major),'') IS NOT NULL;
 IF cardinality(v_grades)>12 OR cardinality(v_majors)>40 THEN RAISE EXCEPTION 'School structure exceeds limits'; END IF;
 UPDATE public.schools SET grades=v_grades,majors=v_majors WHERE id=p_school;
END
$function$

REVOKE ALL ON FUNCTION public.refresh_school_import_structure(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.refresh_school_import_structure(uuid) TO authenticated;
