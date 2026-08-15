-- QR-based self-service induction.
--
-- Adds an opt-in flag per programme plus a set of anon-safe SECURITY DEFINER
-- RPCs, mirroring the existing public machine (get_machine_public) and fleet
-- pre-start inspection (get_org_active_drivers_public etc.) pattern.
--
-- Unlike the fleet pre-start flow, this does NOT grant anon any direct table
-- RLS access. Every write goes through a purpose-built RPC that validates
-- and performs the write itself, and quiz correct answers are never
-- returned to the client. This keeps the anon-facing surface smaller and
-- easier to reason about than raw anon INSERT policies would be.

ALTER TABLE public.induction_programmes
  ADD COLUMN IF NOT EXISTS qr_self_service_enabled boolean NOT NULL DEFAULT false;

-- 1. Programme details for the landing screen after a scan.
CREATE OR REPLACE FUNCTION public.get_induction_programme_public(_programme_id uuid)
RETURNS TABLE (id uuid, name text, description text, pass_mark_percent int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.description, p.pass_mark_percent
  FROM public.induction_programmes p
  WHERE p.id = _programme_id
    AND p.is_active = true
    AND p.qr_self_service_enabled = true
$$;

-- 2. Name picker — mirrors get_org_active_drivers_public.
CREATE OR REPLACE FUNCTION public.get_inductees_for_programme_public(_programme_id uuid)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.full_name
  FROM public.inductees i
  JOIN public.induction_programmes p ON p.organisation_id = i.organisation_id
  WHERE p.id = _programme_id
    AND p.is_active = true
    AND p.qr_self_service_enabled = true
  ORDER BY i.full_name
$$;

-- 3. Module content (no quiz answers here — modules don't carry them).
CREATE OR REPLACE FUNCTION public.get_induction_modules_public(_programme_id uuid)
RETURNS TABLE (
  id uuid, title text, content_type text, content_text text,
  video_url text, document_url text, order_index int, has_quiz boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.title, m.content_type, m.content_text, m.video_url, m.document_url, m.order_index, m.has_quiz
  FROM public.induction_modules m
  JOIN public.induction_programmes p ON p.id = m.programme_id
  WHERE p.id = _programme_id
    AND p.is_active = true
    AND p.qr_self_service_enabled = true
  ORDER BY m.order_index
$$;

-- 4. Quiz questions WITHOUT correct_answer — never expose the answer key to anon.
CREATE OR REPLACE FUNCTION public.get_induction_quiz_questions_public(_module_id uuid)
RETURNS TABLE (id uuid, question_text text, question_type text, options jsonb, order_index int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.question_text, q.question_type, q.options, q.order_index
  FROM public.induction_quiz_questions q
  JOIN public.induction_modules m ON m.id = q.module_id
  JOIN public.induction_programmes p ON p.id = m.programme_id
  WHERE q.module_id = _module_id
    AND p.is_active = true
    AND p.qr_self_service_enabled = true
  ORDER BY q.order_index
$$;

-- 5. Start (or resume) a record for the picked inductee.
CREATE OR REPLACE FUNCTION public.start_induction_public(_programme_id uuid, _inductee_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_record_id uuid;
BEGIN
  SELECT p.organisation_id INTO v_org
  FROM public.induction_programmes p
  WHERE p.id = _programme_id AND p.is_active = true AND p.qr_self_service_enabled = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Programme not available for self-service';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.inductees i WHERE i.id = _inductee_id AND i.organisation_id = v_org) THEN
    RAISE EXCEPTION 'Inductee not found for this programme';
  END IF;

  SELECT r.id INTO v_record_id
  FROM public.induction_records r
  WHERE r.programme_id = _programme_id
    AND r.inductee_id = _inductee_id
    AND r.status <> 'completed'
  ORDER BY r.started_at DESC
  LIMIT 1;

  IF v_record_id IS NULL THEN
    INSERT INTO public.induction_records (inductee_id, programme_id, organisation_id, status)
    VALUES (_inductee_id, _programme_id, v_org, 'in_progress')
    RETURNING id INTO v_record_id;
  END IF;

  RETURN v_record_id;
END;
$$;

-- 6. Score a module's quiz server-side and record the result.
CREATE OR REPLACE FUNCTION public.submit_induction_quiz_public(_record_id uuid, _module_id uuid, _answers jsonb)
RETURNS TABLE (score_percent numeric, passed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pass_mark int;
  v_total int;
  v_correct int;
  v_score numeric;
  v_pass boolean;
  v_existing_id uuid;
BEGIN
  SELECT p.pass_mark_percent INTO v_pass_mark
  FROM public.induction_records r
  JOIN public.induction_programmes p ON p.id = r.programme_id
  JOIN public.induction_modules m ON m.id = _module_id AND m.programme_id = r.programme_id
  WHERE r.id = _record_id
    AND p.is_active = true
    AND p.qr_self_service_enabled = true;

  IF v_pass_mark IS NULL THEN
    RAISE EXCEPTION 'Record/module not available for self-service';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE _answers ->> q.id::text = q.correct_answer)
  INTO v_total, v_correct
  FROM public.induction_quiz_questions q
  WHERE q.module_id = _module_id;

  v_score := CASE WHEN v_total > 0 THEN round((v_correct::numeric / v_total) * 100) ELSE 100 END;
  v_pass := v_score >= v_pass_mark;

  SELECT mr.id INTO v_existing_id
  FROM public.induction_module_results mr
  WHERE mr.induction_record_id = _record_id AND mr.module_id = _module_id;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.induction_module_results
      (induction_record_id, module_id, score_percent, passed, attempts, answers_given)
    VALUES (_record_id, _module_id, v_score, v_pass, 1, _answers);
  ELSE
    UPDATE public.induction_module_results
    SET score_percent = v_score, passed = v_pass, attempts = attempts + 1,
        completed_at = now(), answers_given = _answers
    WHERE id = v_existing_id;
  END IF;

  RETURN QUERY SELECT v_score, v_pass;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_induction_programme_public(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_inductees_for_programme_public(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_induction_modules_public(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_induction_quiz_questions_public(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_induction_public(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_induction_quiz_public(uuid, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_induction_programme_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inductees_for_programme_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_induction_modules_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_induction_quiz_questions_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_induction_public(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_induction_quiz_public(uuid, uuid, jsonb) TO anon, authenticated;
