-- Enable public submission of contractor/vendor risk assessments & RAMS via QR code
-- Grants anon permissions, sets RLS insert/select policies, adds secure RPC functions,
-- and sends an in-app notification to the safety and maintenance team upon submission.

GRANT INSERT, SELECT ON public.risk_assessments TO anon;

DROP POLICY IF EXISTS "anyone can submit vendor risk assessment" ON public.risk_assessments;
CREATE POLICY "anyone can submit vendor risk assessment"
ON public.risk_assessments FOR INSERT
TO anon, authenticated
WITH CHECK (
  organisation_id IS NOT NULL
  AND status = 'pending_approval'
);

DROP POLICY IF EXISTS "anon can view submitted risk assessment status" ON public.risk_assessments;
CREATE POLICY "anon can view submitted risk assessment status"
ON public.risk_assessments FOR SELECT
TO anon
USING (status IN ('pending_approval', 'approved', 'rejected'));

-- RPC for secure submission with org validation
CREATE OR REPLACE FUNCTION public.submit_vendor_risk_assessment_public(
  _org_id uuid,
  _title text,
  _activity text,
  _overall_risk text,
  _review_note text,
  _machine_id uuid DEFAULT NULL,
  _work_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = _org_id) THEN
    RAISE EXCEPTION 'Invalid organisation ID';
  END IF;

  INSERT INTO public.risk_assessments (
    organisation_id,
    title,
    activity,
    status,
    overall_risk,
    submitted_at,
    review_note,
    machine_id,
    work_order_id
  ) VALUES (
    _org_id,
    COALESCE(_title, 'Vendor RAMS'),
    _activity,
    'pending_approval',
    COALESCE(_overall_risk, 'medium'),
    now(),
    _review_note,
    _machine_id,
    _work_order_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_vendor_risk_assessment_public(uuid, text, text, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vendor_risk_assessment_public(uuid, text, text, text, text, uuid, uuid) TO anon, authenticated;

-- RPC for checking public risk assessment status
CREATE OR REPLACE FUNCTION public.get_vendor_risk_assessment_status_public(_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  reviewed_at timestamptz,
  reviewed_by uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.status, r.reviewed_at, r.reviewed_by
  FROM public.risk_assessments r
  WHERE r.id = _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vendor_risk_assessment_status_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_risk_assessment_status_public(uuid) TO anon, authenticated;

-- Notification trigger for safety/maintenance feed
CREATE OR REPLACE FUNCTION public.notify_new_vendor_risk_assessment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor_name text;
  v_note jsonb;
BEGIN
  IF NEW.created_by IS NOT NULL OR NEW.status <> 'pending_approval' THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.review_note IS NOT NULL AND NEW.review_note LIKE '{%' THEN
      v_note := NEW.review_note::jsonb;
      v_vendor_name := v_note->>'vendor_company';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_vendor_name := NULL;
  END;

  INSERT INTO public.maintenance_notifications (
    organisation_id,
    machine_id,
    title,
    description,
    severity,
    reported_by
  ) VALUES (
    NEW.organisation_id,
    NEW.machine_id,
    'New Vendor RAMS / Risk Assessment Submitted',
    COALESCE(v_vendor_name, 'Contractor') || ' submitted a Risk Assessment for approval: ' || NEW.title,
    CASE WHEN NEW.overall_risk IN ('high', 'critical') THEN 'high' ELSE 'medium' END,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_vendor_risk_assessment ON public.risk_assessments;
CREATE TRIGGER trg_notify_new_vendor_risk_assessment
AFTER INSERT ON public.risk_assessments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_vendor_risk_assessment();
