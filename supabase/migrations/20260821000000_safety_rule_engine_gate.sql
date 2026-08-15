-- Tighten the safety rule engine from advisory-only into an actual gate.
-- Previously safety_rules only drove a UI banner in WorkOrderNew.tsx; a work
-- order matching a rule could still be started without a risk assessment,
-- LOTO, PTW, or a competent assignee ever existing. This adds a DB trigger
-- that independently re-evaluates matching rules at the moment a work order
-- tries to move to in_progress, so the gate holds even if a WO is edited
-- after creation, work_type is changed, or a row is inserted by some other
-- path that skips WorkOrderNew.tsx entirely.
CREATE OR REPLACE FUNCTION public.block_wo_start_rule_requirements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_machine_category text;
  v_needs_ra boolean;
  v_needs_loto boolean;
  v_needs_ptw boolean;
  v_competencies text[];
  v_competency text;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    SELECT category INTO v_machine_category FROM public.machines WHERE id = NEW.machine_id;

    SELECT
      bool_or(requires_risk_assessment),
      bool_or(requires_loto),
      bool_or(requires_ptw),
      array_remove(array_agg(DISTINCT requires_competency), NULL)
    INTO v_needs_ra, v_needs_loto, v_needs_ptw, v_competencies
    FROM public.safety_rules
    WHERE organisation_id = NEW.organisation_id
      AND is_active = true
      AND (
        (match_field = 'work_type' AND match_value = lower(NEW.work_type))
        OR (match_field = 'machine_category' AND v_machine_category IS NOT NULL AND match_value = lower(v_machine_category))
      );

    IF v_needs_ra AND NOT EXISTS (
      SELECT 1 FROM public.risk_assessments WHERE work_order_id = NEW.id AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'A safety rule requires an approved Risk Assessment before this job can start';
    END IF;

    IF v_needs_loto AND NOT EXISTS (
      SELECT 1 FROM public.wo_loto_checklists WHERE work_order_id = NEW.id AND status = 'verified'
    ) THEN
      RAISE EXCEPTION 'A safety rule requires verified LOTO before this job can start';
    END IF;

    IF v_needs_ptw AND NOT EXISTS (
      SELECT 1 FROM public.wo_safety_approvals WHERE work_order_id = NEW.id AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'A safety rule requires an approved Permit to Work before this job can start';
    END IF;

    IF v_competencies IS NOT NULL AND array_length(v_competencies, 1) > 0 THEN
      IF NEW.assignee_id IS NULL THEN
        RAISE EXCEPTION 'A safety rule requires an authorized (competent) assignee before this job can start';
      END IF;
      FOREACH v_competency IN ARRAY v_competencies LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.employee_competencies
          WHERE employee_id = NEW.assignee_id
            AND status = 'active'
            AND competency_name = v_competency
            AND (expiry_date IS NULL OR expiry_date >= current_date)
        ) THEN
          RAISE EXCEPTION 'Assignee is not authorized: missing or expired competency "%"', v_competency;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_wo_start_rule_requirements
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.block_wo_start_rule_requirements();
