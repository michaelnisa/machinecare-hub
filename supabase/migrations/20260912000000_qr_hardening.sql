-- QR surface hardening:
--   1. machines.qr_enabled — a per-machine kill switch mirroring
--      induction_programmes.qr_self_service_enabled, so a lost/misused
--      sticker can be revoked without deleting the machine record.
--   2. A generic rate-limit helper + triggers/RPC checks on every
--      anonymous QR-facing write path (fault reports, pre-start
--      inspections, induction start/quiz submission), since none of
--      that surface had any throttling before this migration.

-- 1. Per-machine QR kill switch -------------------------------------------
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_machine_public(uuid);
CREATE FUNCTION public.get_machine_public(_machine_id uuid)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  name text,
  category text,
  make text,
  model text,
  year int,
  registration_number text,
  serial_number text,
  status text,
  cover_image_url text,
  current_hours numeric,
  organisation_name text,
  plate_number text,
  last_service_date timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.organisation_id, m.name, m.category, m.make, m.model, m.year,
         m.registration_number, m.serial_number, m.status, m.cover_image_url,
         m.current_hours, o.name, m.plate_number,
         (SELECT MAX(sl.performed_at) FROM public.service_logs sl WHERE sl.machine_id = m.id)
  FROM public.machines m
  JOIN public.organisations o ON o.id = m.organisation_id
  WHERE m.id = _machine_id
    AND m.qr_enabled = true
$$;

GRANT EXECUTE ON FUNCTION public.get_machine_public(uuid) TO anon, authenticated;

-- 2. Generic rate limiter ---------------------------------------------------
-- Not RLS-protected: only ever touched by SECURITY DEFINER functions/triggers
-- below, which run with the owning role's privileges regardless of grants.
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_bucket_created
  ON public.rate_limit_log (bucket, created_at);

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(_bucket text, _max_count int, _window_minutes int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - (_window_minutes || ' minutes')::interval;

  SELECT count(*) INTO v_count
  FROM public.rate_limit_log
  WHERE bucket = _bucket
    AND created_at > now() - (_window_minutes || ' minutes')::interval;

  IF v_count >= _max_count THEN
    RAISE EXCEPTION 'Too many requests — please wait a few minutes and try again' USING ERRCODE = '55006';
  END IF;

  INSERT INTO public.rate_limit_log (bucket) VALUES (_bucket);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) TO anon, authenticated, service_role;

-- 3. Throttle anonymous fault reports (per machine) -------------------------
CREATE OR REPLACE FUNCTION public.rl_fault_reports()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rate_limit('fault_report:' || NEW.machine_id::text, 8, 15);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rl_fault_reports ON public.fault_reports;
CREATE TRIGGER trg_rl_fault_reports
BEFORE INSERT ON public.fault_reports
FOR EACH ROW EXECUTE FUNCTION public.rl_fault_reports();

-- 4. Throttle anonymous pre-start inspection submissions (per machine) ------
CREATE OR REPLACE FUNCTION public.rl_checklist_executions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.machine_id IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('checklist_exec:' || NEW.machine_id::text, 20, 15);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rl_checklist_executions ON public.checklist_executions;
CREATE TRIGGER trg_rl_checklist_executions
BEFORE INSERT ON public.checklist_executions
FOR EACH ROW EXECUTE FUNCTION public.rl_checklist_executions();

-- 5. Throttle induction self-service start/quiz submission ------------------
CREATE OR REPLACE FUNCTION public.start_induction_public(_programme_id uuid, _inductee_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_record_id uuid;
BEGIN
  PERFORM public.enforce_rate_limit('induction_start:' || _inductee_id::text, 10, 15);

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
  PERFORM public.enforce_rate_limit('induction_quiz:' || _record_id::text || ':' || _module_id::text, 10, 30);

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

GRANT EXECUTE ON FUNCTION public.start_induction_public(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_induction_quiz_public(uuid, uuid, jsonb) TO anon, authenticated;
