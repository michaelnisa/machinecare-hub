-- Safety module: Controlled Tools, Safety Documents/Knowledge library, and a
-- configurable Safety Rule Engine (replaces hardcoded "if electrical then
-- require permit+LOTO" logic with organisation-editable rules).

-- ===== Controlled Tools =====
CREATE TABLE public.controlled_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tool_type text NOT NULL DEFAULT 'other', -- welding | electrical_tester | gas_equipment | torque_wrench | lifting_equipment | confined_space_equipment | other
  asset_tag text,
  requires_certification text, -- competency name required to be issued this tool, if any
  requires_safety_approval boolean NOT NULL DEFAULT true,
  calibration_due_date date,
  condition text NOT NULL DEFAULT 'good', -- good | fair | needs_service | out_of_service
  location text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controlled_tools TO authenticated;
GRANT ALL ON public.controlled_tools TO service_role;
ALTER TABLE public.controlled_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ct select" ON public.controlled_tools FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ct insert" ON public.controlled_tools FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ct update" ON public.controlled_tools FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ct delete" ON public.controlled_tools FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.controlled_tool_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.controlled_tools WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.controlled_tool_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.controlled_tools(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | issued | returned
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamptz,
  acknowledged_at timestamptz,
  returned_at timestamptz,
  condition_on_return text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controlled_tool_requests TO authenticated;
GRANT ALL ON public.controlled_tool_requests TO service_role;
ALTER TABLE public.controlled_tool_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_controlled_tool_requests_tool ON public.controlled_tool_requests(tool_id, status);

CREATE POLICY "ctr2 select" ON public.controlled_tool_requests FOR SELECT TO authenticated
  USING (controlled_tool_in_org(tool_id));
CREATE POLICY "ctr2 insert" ON public.controlled_tool_requests FOR INSERT TO authenticated
  WITH CHECK (controlled_tool_in_org(tool_id) AND can_write(current_org_id()));
CREATE POLICY "ctr2 update" ON public.controlled_tool_requests FOR UPDATE TO authenticated
  USING (controlled_tool_in_org(tool_id) AND can_write(current_org_id()));
CREATE POLICY "ctr2 delete" ON public.controlled_tool_requests FOR DELETE TO authenticated
  USING (controlled_tool_in_org(tool_id) AND can_manage(current_org_id()));

-- Only Safety may approve/reject a controlled-tool request, and only when the
-- requester holds the tool's required certification (if any), not expired.
CREATE OR REPLACE FUNCTION public.enforce_controlled_tool_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_required text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    SELECT organisation_id INTO v_org FROM public.controlled_tools WHERE id = NEW.tool_id;
    IF NOT can_review_safety(v_org) THEN
      RAISE EXCEPTION 'Only Safety may approve or reject a controlled tool request';
    END IF;
    IF NEW.status = 'approved' THEN
      SELECT requires_certification INTO v_required FROM public.controlled_tools WHERE id = NEW.tool_id;
      IF v_required IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.employee_competencies
        WHERE employee_id = NEW.requested_by
          AND status = 'active'
          AND competency_name = v_required
          AND (expiry_date IS NULL OR expiry_date >= current_date)
      ) THEN
        RAISE EXCEPTION 'Requester does not hold the required certification (%) for this tool', v_required;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_controlled_tool_review
BEFORE UPDATE ON public.controlled_tool_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_controlled_tool_review();

-- ===== Safety Documents & Knowledge library =====
-- Organisation-wide (not machine-scoped, unlike the existing `documents`
-- table): policies, SOPs, emergency plans, permit templates, and knowledge
-- articles. Optionally linked to a machine for context.
CREATE TABLE public.safety_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other', -- policy | procedure | sop | emergency_plan | permit_template | manual | knowledge_article | other
  content text, -- article body, for knowledge_article rows without a file
  file_url text,
  file_type text,
  version text,
  owner uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  review_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active', -- active | under_review | expired | archived
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_documents TO authenticated;
GRANT ALL ON public.safety_documents TO service_role;
ALTER TABLE public.safety_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_safety_documents_category ON public.safety_documents(organisation_id, category);

CREATE POLICY "sd select" ON public.safety_documents FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sd insert" ON public.safety_documents FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sd update" ON public.safety_documents FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sd delete" ON public.safety_documents FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Configurable Safety Rule Engine =====
-- Replaces hardcoded "if work_type = electrical then require permit+LOTO"
-- logic with organisation-editable rules, matched client-side against a new
-- work order's work_type / machine_category and shown as a requirements
-- banner (advisory — the actual gates remain the existing PTW/risk
-- assessment/LOTO triggers on work_orders, which stay authoritative).
CREATE TABLE public.safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  match_field text NOT NULL DEFAULT 'work_type', -- work_type | machine_category
  match_value text NOT NULL,
  requires_risk_assessment boolean NOT NULL DEFAULT false,
  requires_loto boolean NOT NULL DEFAULT false,
  requires_ptw boolean NOT NULL DEFAULT false,
  requires_competency text,
  required_ppe text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_rules TO authenticated;
GRANT ALL ON public.safety_rules TO service_role;
ALTER TABLE public.safety_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sr select" ON public.safety_rules FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sr insert" ON public.safety_rules FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "sr update" ON public.safety_rules FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "sr delete" ON public.safety_rules FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));
