-- Inventory module Phase 5 (per Inventory_New.md): Tools & Equipment,
-- Calibration Management, PPE, Controlled Inventory, Safety Integration.
--
-- Deliberately does NOT create a new `tools` entity — the Safety module
-- already built controlled_tools/controlled_tool_requests (request → Safety
-- approval → issue → acknowledge → return, with a DB trigger enforcing
-- required certification) and ppe_issues/ppe_requirements, which is exactly
-- what this phase asks for. This migration extends controlled_tools with
-- the missing Tool Master fields (serial/manufacturer/model/status/assigned
-- holder) and adds calibration history + a configurable "block checkout if
-- calibration expired" policy, then keeps the tool's status in sync with
-- checkout activity automatically.

ALTER TABLE public.controlled_tools
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available', -- available | issued | reserved | under_maintenance | under_calibration | lost | damaged | retired
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_calibration_date date;

-- Company policy: block issuing a tool whose calibration has expired.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS block_expired_calibration_checkout boolean NOT NULL DEFAULT true;

-- Calibration history per tool.
CREATE TABLE public.calibration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.controlled_tools(id) ON DELETE CASCADE,
  calibrated_on date NOT NULL DEFAULT current_date,
  next_due date,
  calibrated_by text, -- external calibration house or internal technician name
  certificate_url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.calibration_logs TO authenticated;
GRANT ALL ON public.calibration_logs TO service_role;
ALTER TABLE public.calibration_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_calibration_logs_tool ON public.calibration_logs(tool_id, calibrated_on DESC);

CREATE POLICY "cl select" ON public.calibration_logs FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "cl insert" ON public.calibration_logs FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

-- Logging a calibration updates the tool's last/next calibration dates.
CREATE OR REPLACE FUNCTION public.apply_calibration_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.controlled_tools
  SET last_calibration_date = NEW.calibrated_on,
      calibration_due_date = COALESCE(NEW.next_due, calibration_due_date),
      status = CASE WHEN status = 'under_calibration' THEN 'available' ELSE status END
  WHERE id = NEW.tool_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_calibration_log
AFTER INSERT ON public.calibration_logs
FOR EACH ROW EXECUTE FUNCTION public.apply_calibration_log();

-- Extend the existing review trigger: also block approval when calibration
-- has expired and the org's policy says to block (default true).
CREATE OR REPLACE FUNCTION public.enforce_controlled_tool_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_required text;
  v_calibration_due date;
  v_block_expired boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    SELECT organisation_id, calibration_due_date INTO v_org, v_calibration_due FROM public.controlled_tools WHERE id = NEW.tool_id;
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

      SELECT block_expired_calibration_checkout INTO v_block_expired FROM public.organisations WHERE id = v_org;
      IF v_block_expired AND v_calibration_due IS NOT NULL AND v_calibration_due < current_date THEN
        RAISE EXCEPTION 'This tool''s calibration expired on % — it cannot be issued until recalibrated', v_calibration_due;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keep the tool's Master status/holder in sync with checkout activity.
CREATE OR REPLACE FUNCTION public.sync_controlled_tool_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'issued' THEN
      UPDATE public.controlled_tools SET status = 'issued', assigned_to = NEW.requested_by WHERE id = NEW.tool_id;
    ELSIF NEW.status = 'returned' THEN
      UPDATE public.controlled_tools
      SET status = 'available', assigned_to = NULL,
          condition = COALESCE(NEW.condition_on_return, condition)
      WHERE id = NEW.tool_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_controlled_tool_status
AFTER UPDATE ON public.controlled_tool_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_controlled_tool_status();
