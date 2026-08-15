-- Safety & People department (mirrors the Production department pattern from
-- 20260814000000_production_department_rls.sql, reusing has_department_access())
-- plus a Permit to Work (PTW) workflow on work orders.

-- ===== Department gating: safety_incidents =====
DROP POLICY IF EXISTS "si select" ON public.safety_incidents;
DROP POLICY IF EXISTS "si insert" ON public.safety_incidents;
DROP POLICY IF EXISTS "si update" ON public.safety_incidents;
DROP POLICY IF EXISTS "si delete" ON public.safety_incidents;

CREATE POLICY "si select" ON public.safety_incidents FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('safety'));
CREATE POLICY "si insert" ON public.safety_incidents FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "si update" ON public.safety_incidents FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "si delete" ON public.safety_incidents FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));

-- ===== Department gating: induction_programmes =====
DROP POLICY IF EXISTS "ip select" ON public.induction_programmes;
DROP POLICY IF EXISTS "ip insert" ON public.induction_programmes;
DROP POLICY IF EXISTS "ip update" ON public.induction_programmes;
DROP POLICY IF EXISTS "ip delete" ON public.induction_programmes;

CREATE POLICY "ip select" ON public.induction_programmes FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('safety'));
CREATE POLICY "ip insert" ON public.induction_programmes FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ip update" ON public.induction_programmes FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ip delete" ON public.induction_programmes FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));

-- ===== Department gating: induction_modules =====
DROP POLICY IF EXISTS "im select" ON public.induction_modules;
DROP POLICY IF EXISTS "im insert" ON public.induction_modules;
DROP POLICY IF EXISTS "im update" ON public.induction_modules;
DROP POLICY IF EXISTS "im delete" ON public.induction_modules;

CREATE POLICY "im select" ON public.induction_modules FOR SELECT TO authenticated
  USING (programme_in_org(programme_id) AND has_department_access('safety'));
CREATE POLICY "im insert" ON public.induction_modules FOR INSERT TO authenticated
  WITH CHECK (programme_in_org(programme_id) AND can_manage(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "im update" ON public.induction_modules FOR UPDATE TO authenticated
  USING (programme_in_org(programme_id) AND can_manage(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "im delete" ON public.induction_modules FOR DELETE TO authenticated
  USING (programme_in_org(programme_id) AND can_manage(current_org_id()) AND has_department_access('safety'));

-- ===== Department gating: induction_quiz_questions =====
DROP POLICY IF EXISTS "iq select" ON public.induction_quiz_questions;
DROP POLICY IF EXISTS "iq insert" ON public.induction_quiz_questions;
DROP POLICY IF EXISTS "iq update" ON public.induction_quiz_questions;
DROP POLICY IF EXISTS "iq delete" ON public.induction_quiz_questions;

CREATE POLICY "iq select" ON public.induction_quiz_questions FOR SELECT TO authenticated
  USING (module_in_org(module_id) AND has_department_access('safety'));
CREATE POLICY "iq insert" ON public.induction_quiz_questions FOR INSERT TO authenticated
  WITH CHECK (module_in_org(module_id) AND can_manage(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "iq update" ON public.induction_quiz_questions FOR UPDATE TO authenticated
  USING (module_in_org(module_id) AND can_manage(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "iq delete" ON public.induction_quiz_questions FOR DELETE TO authenticated
  USING (module_in_org(module_id) AND can_manage(current_org_id()) AND has_department_access('safety'));

-- ===== Department gating: inductees =====
DROP POLICY IF EXISTS "ind select" ON public.inductees;
DROP POLICY IF EXISTS "ind insert" ON public.inductees;
DROP POLICY IF EXISTS "ind update" ON public.inductees;
DROP POLICY IF EXISTS "ind delete" ON public.inductees;

CREATE POLICY "ind select" ON public.inductees FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('safety'));
CREATE POLICY "ind insert" ON public.inductees FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ind update" ON public.inductees FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ind delete" ON public.inductees FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));

-- ===== Department gating: induction_records =====
DROP POLICY IF EXISTS "ir select" ON public.induction_records;
DROP POLICY IF EXISTS "ir insert" ON public.induction_records;
DROP POLICY IF EXISTS "ir update" ON public.induction_records;
DROP POLICY IF EXISTS "ir delete" ON public.induction_records;

CREATE POLICY "ir select" ON public.induction_records FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('safety'));
CREATE POLICY "ir insert" ON public.induction_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ir update" ON public.induction_records FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "ir delete" ON public.induction_records FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));

-- ===== Department gating: induction_module_results =====
DROP POLICY IF EXISTS "imr select" ON public.induction_module_results;
DROP POLICY IF EXISTS "imr insert" ON public.induction_module_results;
DROP POLICY IF EXISTS "imr update" ON public.induction_module_results;
DROP POLICY IF EXISTS "imr delete" ON public.induction_module_results;

CREATE POLICY "imr select" ON public.induction_module_results FOR SELECT TO authenticated
  USING (record_in_org(induction_record_id) AND has_department_access('safety'));
CREATE POLICY "imr insert" ON public.induction_module_results FOR INSERT TO authenticated
  WITH CHECK (record_in_org(induction_record_id) AND can_write(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "imr update" ON public.induction_module_results FOR UPDATE TO authenticated
  USING (record_in_org(induction_record_id) AND can_write(current_org_id()) AND has_department_access('safety'));
CREATE POLICY "imr delete" ON public.induction_module_results FOR DELETE TO authenticated
  USING (record_in_org(induction_record_id) AND can_manage(current_org_id()) AND has_department_access('safety'));

-- ===== Permit to Work =====
CREATE TABLE public.wo_safety_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wo_safety_approvals TO authenticated;
GRANT ALL ON public.wo_safety_approvals TO service_role;
ALTER TABLE public.wo_safety_approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_wo_safety_approvals_wo ON public.wo_safety_approvals(work_order_id, status);

CREATE POLICY "wsa select" ON public.wo_safety_approvals FOR SELECT TO authenticated
  USING (
    organisation_id = current_org_id()
    AND (has_department_access('safety') OR requested_by = auth.uid())
  );
CREATE POLICY "wsa insert" ON public.wo_safety_approvals FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "wsa update" ON public.wo_safety_approvals FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('safety'));
CREATE POLICY "wsa delete" ON public.wo_safety_approvals FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('safety'));

-- Block starting a work order while a PTW request is still pending. This is a
-- trigger on work_orders itself (not inside transition_wo) because status
-- changes today come from three different code paths — the transition_wo RPC,
-- plus two direct .update({status}) call sites in MobileMachine.tsx and
-- Vendors.tsx that bypass it — and a table-level trigger closes all of them
-- at once regardless of which path fires the update.
CREATE OR REPLACE FUNCTION public.block_wo_start_pending_ptw()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    IF EXISTS (
      SELECT 1 FROM public.wo_safety_approvals
      WHERE work_order_id = NEW.id AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'This work order has a pending Permit to Work request — it must be approved by Safety before work can start';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_wo_start_pending_ptw
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.block_wo_start_pending_ptw();
