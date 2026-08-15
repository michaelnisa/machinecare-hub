-- Safety module expansion: Risk Assessment/JSA, LOTO, Corrective Actions,
-- Safety Inspections, and Machine Safety Profiles. Extends the existing
-- Safety department (has_department_access/can_review_safety) and Permit to
-- Work pattern from 20260814020000/20260816000000 rather than reinventing it.

-- ===== Machine Safety Profile =====
CREATE TABLE public.machine_safety_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL UNIQUE REFERENCES public.machines(id) ON DELETE CASCADE,
  hazards text[] NOT NULL DEFAULT '{}',
  energy_sources text[] NOT NULL DEFAULT '{}',
  required_ppe text[] NOT NULL DEFAULT '{}',
  required_competencies text[] NOT NULL DEFAULT '{}',
  required_permit_types text[] NOT NULL DEFAULT '{}',
  loto_procedure_url text,
  emergency_stop_installed boolean NOT NULL DEFAULT false,
  safety_guards_installed boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_safety_profiles TO authenticated;
GRANT ALL ON public.machine_safety_profiles TO service_role;
ALTER TABLE public.machine_safety_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msp select" ON public.machine_safety_profiles FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "msp insert" ON public.machine_safety_profiles FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "msp update" ON public.machine_safety_profiles FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "msp delete" ON public.machine_safety_profiles FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Risk Assessment / JSA =====
CREATE TABLE public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  title text NOT NULL,
  activity text,
  status text NOT NULL DEFAULT 'draft', -- draft | pending_approval | approved | rejected
  overall_risk text, -- low | medium | high | critical
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_risk_assessments_wo ON public.risk_assessments(work_order_id, status);
CREATE INDEX idx_risk_assessments_machine ON public.risk_assessments(machine_id);

CREATE POLICY "ra select" ON public.risk_assessments FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ra insert" ON public.risk_assessments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ra update" ON public.risk_assessments FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ra delete" ON public.risk_assessments FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Only Safety (can_review_safety) may move a risk assessment to approved/rejected.
CREATE OR REPLACE FUNCTION public.enforce_risk_assessment_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    IF NOT can_review_safety(NEW.organisation_id) THEN
      RAISE EXCEPTION 'Only Safety may approve or reject a risk assessment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_risk_assessment_review
BEFORE UPDATE ON public.risk_assessments
FOR EACH ROW EXECUTE FUNCTION public.enforce_risk_assessment_review();

CREATE OR REPLACE FUNCTION public.risk_assessment_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.risk_assessments WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.risk_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id uuid NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  step text,
  hazard text NOT NULL,
  consequence text,
  likelihood smallint,
  severity smallint,
  initial_risk text,
  control_measure text,
  responsible_person text,
  residual_likelihood smallint,
  residual_severity smallint,
  residual_risk text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessment_items TO authenticated;
GRANT ALL ON public.risk_assessment_items TO service_role;
ALTER TABLE public.risk_assessment_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_risk_assessment_items_ra ON public.risk_assessment_items(risk_assessment_id, order_index);

CREATE POLICY "rai select" ON public.risk_assessment_items FOR SELECT TO authenticated
  USING (risk_assessment_in_org(risk_assessment_id));
CREATE POLICY "rai insert" ON public.risk_assessment_items FOR INSERT TO authenticated
  WITH CHECK (risk_assessment_in_org(risk_assessment_id) AND can_write(current_org_id()));
CREATE POLICY "rai update" ON public.risk_assessment_items FOR UPDATE TO authenticated
  USING (risk_assessment_in_org(risk_assessment_id) AND can_write(current_org_id()));
CREATE POLICY "rai delete" ON public.risk_assessment_items FOR DELETE TO authenticated
  USING (risk_assessment_in_org(risk_assessment_id) AND can_write(current_org_id()));

-- ===== Lockout / Tagout (LOTO) =====
CREATE TABLE public.wo_loto_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started', -- not_started | in_progress | verified | closed
  affected_notified_at timestamptz,
  shutdown_at timestamptz,
  stored_energy_released_at timestamptz,
  verified_zero_energy_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  authorized_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at timestamptz,
  locks_removed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wo_loto_checklists TO authenticated;
GRANT ALL ON public.wo_loto_checklists TO service_role;
ALTER TABLE public.wo_loto_checklists ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wo_loto_checklists_wo ON public.wo_loto_checklists(work_order_id, status);

CREATE POLICY "wlc select" ON public.wo_loto_checklists FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "wlc insert" ON public.wo_loto_checklists FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "wlc update" ON public.wo_loto_checklists FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "wlc delete" ON public.wo_loto_checklists FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.loto_checklist_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.wo_loto_checklists WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.wo_loto_energy_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.wo_loto_checklists(id) ON DELETE CASCADE,
  energy_type text NOT NULL, -- electrical | mechanical | pneumatic | hydraulic | thermal | other
  isolated boolean NOT NULL DEFAULT false,
  lock_id text,
  tag_id text,
  isolated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  isolated_at timestamptz,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wo_loto_energy_sources TO authenticated;
GRANT ALL ON public.wo_loto_energy_sources TO service_role;
ALTER TABLE public.wo_loto_energy_sources ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wo_loto_energy_sources_checklist ON public.wo_loto_energy_sources(checklist_id);

CREATE POLICY "wles select" ON public.wo_loto_energy_sources FOR SELECT TO authenticated
  USING (loto_checklist_in_org(checklist_id));
CREATE POLICY "wles insert" ON public.wo_loto_energy_sources FOR INSERT TO authenticated
  WITH CHECK (loto_checklist_in_org(checklist_id) AND can_write(current_org_id()));
CREATE POLICY "wles update" ON public.wo_loto_energy_sources FOR UPDATE TO authenticated
  USING (loto_checklist_in_org(checklist_id) AND can_write(current_org_id()));
CREATE POLICY "wles delete" ON public.wo_loto_energy_sources FOR DELETE TO authenticated
  USING (loto_checklist_in_org(checklist_id) AND can_write(current_org_id()));

-- ===== Corrective Actions =====
CREATE TABLE public.corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'other', -- incident | near_miss | inspection | risk_assessment | audit | other
  source_id uuid,
  description text NOT NULL,
  responsible_person uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department text,
  priority text NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  due_date date,
  status text NOT NULL DEFAULT 'open', -- open | in_progress | pending_verification | closed
  evidence_note text,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_corrective_actions_status ON public.corrective_actions(organisation_id, status, due_date);
CREATE INDEX idx_corrective_actions_source ON public.corrective_actions(source_type, source_id);

CREATE POLICY "ca select" ON public.corrective_actions FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ca insert" ON public.corrective_actions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ca update" ON public.corrective_actions FOR UPDATE TO authenticated
  USING (
    organisation_id = current_org_id()
    AND (can_review_safety(organisation_id) OR responsible_person = auth.uid())
  );
CREATE POLICY "ca delete" ON public.corrective_actions FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Only Safety may verify/close a corrective action.
CREATE OR REPLACE FUNCTION public.enforce_corrective_action_closure()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('pending_verification', 'closed') THEN
    IF NEW.status = 'closed' AND NOT can_review_safety(NEW.organisation_id) THEN
      RAISE EXCEPTION 'Only Safety may verify and close a corrective action';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_corrective_action_closure
BEFORE UPDATE ON public.corrective_actions
FOR EACH ROW EXECUTE FUNCTION public.enforce_corrective_action_closure();

-- ===== Safety Inspections =====
CREATE TABLE public.safety_inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  items jsonb NOT NULL DEFAULT '[]', -- [{ "label": "Emergency exits clear" }, ...]
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_inspection_templates TO authenticated;
GRANT ALL ON public.safety_inspection_templates TO service_role;
ALTER TABLE public.safety_inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sit select" ON public.safety_inspection_templates FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sit insert" ON public.safety_inspection_templates FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "sit update" ON public.safety_inspection_templates FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "sit delete" ON public.safety_inspection_templates FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TABLE public.safety_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.safety_inspection_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  location text,
  inspected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]', -- [{ "label", "result": "pass|fail|observation|na", "comment" }]
  overall_result text, -- pass | fail | pass_with_findings
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_inspections TO authenticated;
GRANT ALL ON public.safety_inspections TO service_role;
ALTER TABLE public.safety_inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_safety_inspections_machine ON public.safety_inspections(machine_id, inspected_at);

CREATE POLICY "si2 select" ON public.safety_inspections FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "si2 insert" ON public.safety_inspections FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "si2 update" ON public.safety_inspections FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "si2 delete" ON public.safety_inspections FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Auto-create a Corrective Action for every failed inspection item.
CREATE OR REPLACE FUNCTION public.create_corrective_actions_from_inspection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    IF item->>'result' = 'fail' THEN
      INSERT INTO public.corrective_actions
        (organisation_id, source_type, source_id, description, department, priority, status, created_by)
      VALUES
        (NEW.organisation_id, 'inspection', NEW.id,
         concat_ws(': ', NEW.template_name, item->>'label'),
         'safety', 'medium', 'open', NEW.inspected_by);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_corrective_actions_from_inspection
AFTER INSERT ON public.safety_inspections
FOR EACH ROW EXECUTE FUNCTION public.create_corrective_actions_from_inspection();

-- ===== Work order safety gate: block starting work while a Risk Assessment
-- is pending Safety approval, or while LOTO isn't verified. Both are opt-in
-- (created only when the job needs them) — mirrors trg_block_wo_start_pending_ptw
-- from 20260814020000_safety_department_and_ptw.sql, and is a separate
-- trigger on work_orders (not inside transition_wo) for the same reason:
-- multiple update code paths bypass that RPC.
CREATE OR REPLACE FUNCTION public.block_wo_start_unresolved_safety()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    IF EXISTS (
      SELECT 1 FROM public.risk_assessments
      WHERE work_order_id = NEW.id AND status = 'pending_approval'
    ) THEN
      RAISE EXCEPTION 'This work order has a Risk Assessment pending Safety approval — it must be approved before work can start';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.wo_loto_checklists
      WHERE work_order_id = NEW.id AND status IN ('not_started', 'in_progress')
    ) THEN
      RAISE EXCEPTION 'This work order requires Lockout/Tagout — isolation must be verified before work can start';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_wo_start_unresolved_safety
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.block_wo_start_unresolved_safety();
