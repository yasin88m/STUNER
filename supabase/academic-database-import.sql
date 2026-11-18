-- STUNER school course-teacher relations and full academic database imports.
-- Create on a new Supabase project after the base STUNER schema.
CREATE TABLE IF NOT EXISTS public.class_subject_teachers (
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subject text NOT NULL CHECK (char_length(trim(subject)) BETWEEN 1 AND 120),
 PRIMARY KEY (class_id,teacher_id,subject)
);
CREATE INDEX IF NOT EXISTS class_subject_teachers_school_idx ON public.class_subject_teachers(school_id);
CREATE INDEX IF NOT EXISTS class_subject_teachers_teacher_idx ON public.class_subject_teachers(teacher_id);
ALTER TABLE public.class_subject_teachers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_subject_teachers FROM anon;
GRANT SELECT ON public.class_subject_teachers TO authenticated;
DROP POLICY IF EXISTS "subject teaching visible to own class and school" ON public.class_subject_teachers;
CREATE POLICY "subject teaching visible to own class and school" ON public.class_subject_teachers FOR SELECT TO authenticated
USING (
 EXISTS(SELECT 1 FROM public.school_memberships sm WHERE sm.school_id=class_subject_teachers.school_id AND sm.user_id=(SELECT auth.uid())
  AND (sm.role='principal' OR (sm.role='teacher' AND sm.user_id=class_subject_teachers.teacher_id)
    OR (sm.role='student' AND sm.class_id=class_subject_teachers.class_id)))
);

CREATE OR REPLACE FUNCTION public.apply_imported_school_academics(p_school uuid, p_majors text[], p_class_updates jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_kind text;v_majors text[]; v_count int:=0; v_rec jsonb; v_id uuid;v_major text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.school_memberships WHERE school_id=p_school AND user_id=auth.uid() AND role='principal')
 THEN RAISE EXCEPTION 'Principal authorization required'; END IF;
 SELECT kind INTO v_kind FROM public.schools WHERE id=p_school FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'School not found'; END IF;
 IF jsonb_typeof(coalesce(p_class_updates,'[]'::jsonb))<>'array' OR jsonb_array_length(coalesce(p_class_updates,'[]'::jsonb))>100
 THEN RAISE EXCEPTION 'Invalid class update list'; END IF;
 FOR v_rec IN SELECT x FROM jsonb_array_elements(coalesce(p_class_updates,'[]'::jsonb)) x LOOP
  IF (v_rec->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RAISE EXCEPTION 'Invalid class identifier'; END IF;
  v_id:=(v_rec->>'id')::uuid;v_major:=trim(v_rec->>'major');
  IF char_length(v_major) NOT BETWEEN 2 AND 90 OR v_kind NOT IN ('vocational','secondary')
  THEN RAISE EXCEPTION 'Invalid class major'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.school_classes WHERE id=v_id AND school_id=p_school)
  THEN RAISE EXCEPTION 'Class not in school'; END IF;
  IF EXISTS(SELECT 1 FROM public.school_classes WHERE id=v_id AND school_id=p_school AND nullif(trim(major),'') IS NOT NULL AND major IS DISTINCT FROM v_major)
  THEN RAISE EXCEPTION 'Cannot replace assigned class major'; END IF;
  UPDATE public.school_classes SET major=v_major WHERE id=v_id AND school_id=p_school AND nullif(trim(major),'') IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT; -- overwritten for status only
 END LOOP;
 IF cardinality(coalesce(p_majors,'{}'::text[]))>200 OR EXISTS(SELECT 1 FROM unnest(coalesce(p_majors,'{}'::text[])) m WHERE char_length(trim(m)) NOT BETWEEN 2 AND 90)
 THEN RAISE EXCEPTION 'Invalid major catalogue'; END IF;
 IF v_kind NOT IN ('vocational','secondary') AND cardinality(coalesce(p_majors,'{}'::text[]))>0
 THEN RAISE EXCEPTION 'Majors are not available for this school level'; END IF;
 SELECT coalesce(array_agg(DISTINCT m ORDER BY m),'{}'::text[]) INTO v_majors
 FROM (SELECT trim(x) AS m FROM unnest(coalesce(p_majors,'{}'::text[])) x
 UNION SELECT trim(x) FROM public.schools s,unnest(s.majors) x WHERE s.id=p_school
 UNION SELECT trim(major) FROM public.school_classes WHERE school_id=p_school AND nullif(trim(major),'') IS NOT NULL) z
 WHERE m<>'';
 IF cardinality(v_majors)>60 THEN RAISE EXCEPTION 'Too many majors'; END IF;
 UPDATE public.schools SET majors=v_majors WHERE id=p_school;
 RETURN jsonb_build_object('majors',cardinality(v_majors),'updated_class_last',v_count);
END
$function$
;
REVOKE ALL ON FUNCTION public.apply_imported_school_academics(uuid,text[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_imported_school_academics(uuid,text[],jsonb) TO authenticated;

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
 AND NOT EXISTS(SELECT 1 FROM public.class_teachers other WHERE other.teacher_id=m.user_id AND other.school_id<>p_school)
 AND NOT EXISTS(SELECT 1 FROM public.class_subject_teachers other WHERE other.teacher_id=m.user_id AND other.school_id<>p_school);
 DELETE FROM public.assignment_completions c
 USING public.school_assignments a WHERE c.assignment_id=a.id AND a.school_id=p_school;
 DELETE FROM public.school_assignments WHERE school_id=p_school;
 DELETE FROM public.class_subject_teachers WHERE school_id=p_school;
 DELETE FROM public.class_teachers WHERE school_id=p_school;
 DELETE FROM public.school_invites WHERE school_id=p_school;
 DELETE FROM public.school_memberships WHERE school_id=p_school;
 DELETE FROM public.school_classes WHERE school_id=p_school;
 DELETE FROM public.schools WHERE id=p_school;
 RETURN jsonb_build_object('deleted_school',p_school,'member_count',v_n_members,'orphan_users',to_jsonb(v_users));
END
$function$
;
REVOKE ALL ON FUNCTION public.delete_school_records(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_school_records(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.import_school_subject_links(p_school uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row jsonb; v_username text; v_class uuid; v_subject text; v_teacher uuid; v_ok int:=0; v_fail int:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.school_memberships WHERE school_id=p_school AND user_id=auth.uid() AND role='principal'
 ) THEN RAISE EXCEPTION 'Principal authorization required'; END IF;
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Invalid assignment batch'; END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_username:=trim(coalesce(v_row->>'username',''));
  v_subject:=trim(coalesce(v_row->>'subject',''));
  IF v_username !~ '^([a-z][a-z0-9_]{3,31}|[0-9]{10})$'
   OR char_length(v_subject) NOT BETWEEN 1 AND 120
   OR coalesce(v_row->>'class_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN v_fail:=v_fail+1; CONTINUE; END IF;
  v_class:=(v_row->>'class_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.school_classes WHERE id=v_class AND school_id=p_school)
  THEN v_fail:=v_fail+1; CONTINUE; END IF;
  SELECT au.user_id INTO v_teacher FROM public.account_usernames au
  JOIN public.school_memberships m ON m.user_id=au.user_id AND m.school_id=p_school AND m.role='teacher'
  WHERE au.username=v_username;
  IF v_teacher IS NULL THEN v_fail:=v_fail+1; CONTINUE; END IF;
  INSERT INTO public.class_teachers(school_id,class_id,teacher_id) VALUES(p_school,v_class,v_teacher)
  ON CONFLICT (class_id,teacher_id) DO NOTHING;
  INSERT INTO public.class_subject_teachers(school_id,class_id,teacher_id,subject)
  VALUES(p_school,v_class,v_teacher,v_subject)
  ON CONFLICT (class_id,teacher_id,subject) DO NOTHING;
  v_ok:=v_ok+1;
 END LOOP;
 RETURN jsonb_build_object('linked',v_ok,'skipped',v_fail);
END
$function$
;
REVOKE ALL ON FUNCTION public.import_school_subject_links(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_school_subject_links(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_student_class_subjects(p_school uuid, p_class uuid)
 RETURNS TABLE(subject text, teacher_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id=p_school AND m.user_id=auth.uid()
  AND (m.role='principal'
   OR (m.role='student' AND m.class_id=p_class)
   OR (m.role='teacher' AND EXISTS(
     SELECT 1 FROM public.class_teachers t WHERE t.school_id=p_school
      AND t.class_id=p_class AND t.teacher_id=auth.uid())))
 ) THEN RAISE EXCEPTION 'Class access denied'; END IF;
 RETURN QUERY
 SELECT cst.subject,m.display_name
 FROM public.class_subject_teachers cst
 JOIN public.school_memberships m ON m.school_id=cst.school_id
  AND m.user_id=cst.teacher_id AND m.role='teacher'
 WHERE cst.school_id=p_school AND cst.class_id=p_class
 ORDER BY cst.subject,m.display_name;
END
$function$
;
REVOKE ALL ON FUNCTION public.list_student_class_subjects(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_student_class_subjects(uuid,uuid) TO authenticated;