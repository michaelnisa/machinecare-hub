-- ============================================================
-- PHASE 5: Fleet & Logistics — QR pre-start inspection flow
-- Reuses the existing checklist engine (checklist_templates /
-- checklist_template_items / checklist_executions /
-- checklist_execution_responses) rather than duplicating it with
-- separate inspection_* tables, per the fleet spec's own guidance.
-- Adds anon-safe policies so a driver can submit a pre-start
-- inspection from the QR page without signing in.
-- ============================================================

-- 1. Mark a template as the org's fleet pre-start template
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS is_fleet_pre_start boolean NOT NULL DEFAULT false;

-- 2. Link executions to a driver + store a computed overall result
ALTER TABLE public.checklist_executions
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overall_result text;

-- 3. Trace auto-created fault reports back to the inspection that raised them
ALTER TABLE public.fault_reports
  ADD COLUMN IF NOT EXISTS source_execution_id uuid REFERENCES public.checklist_executions(id) ON DELETE SET NULL;

-- 4. Anon-safe insert policies (mirrors the existing "anyone can submit
--    fault report" pattern) — no anon SELECT is granted, so a driver can
--    never read back inspection data, only submit it. The client
--    generates the execution id itself so no select-after-insert is needed.
GRANT INSERT ON public.checklist_executions TO anon;
GRANT INSERT ON public.checklist_execution_responses TO anon;

CREATE POLICY "anon can submit pre-start inspection"
ON public.checklist_executions FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.checklist_templates t ON t.id = template_id
    WHERE m.id = machine_id
      AND m.organisation_id = checklist_executions.organisation_id
      AND t.organisation_id = checklist_executions.organisation_id
      AND t.is_fleet_pre_start = true
      AND t.status = 'approved'
  )
);

CREATE POLICY "anon can submit pre-start inspection responses"
ON public.checklist_execution_responses FOR INSERT
TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id)
);

-- 5. Auto-create a fault report when a tri-state item is marked "not_ok"
CREATE OR REPLACE FUNCTION public.handle_inspection_not_ok()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exec public.checklist_executions%ROWTYPE;
  drv public.drivers%ROWTYPE;
BEGIN
  IF NEW.item_type = 'tri_state' AND NEW.result = 'not_ok' THEN
    SELECT * INTO exec FROM public.checklist_executions WHERE id = NEW.execution_id;
    IF FOUND THEN
      IF exec.driver_id IS NOT NULL THEN
        SELECT * INTO drv FROM public.drivers WHERE id = exec.driver_id;
      END IF;
      INSERT INTO public.fault_reports (
        organisation_id, machine_id, reporter_name, reporter_phone, description, source_execution_id
      ) VALUES (
        exec.organisation_id,
        exec.machine_id,
        COALESCE(drv.full_name, exec.performed_by_name, 'Pre-start inspection'),
        COALESCE(drv.phone, 'N/A'),
        'Pre-start inspection flagged: ' || NEW.item_text_snapshot || COALESCE(' — ' || NEW.notes, ''),
        NEW.execution_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_not_ok ON public.checklist_execution_responses;
CREATE TRIGGER trg_inspection_not_ok
AFTER INSERT ON public.checklist_execution_responses
FOR EACH ROW EXECUTE FUNCTION public.handle_inspection_not_ok();

-- 6. Extend the public machine RPC with fleet fields + last service date
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
$$;

GRANT EXECUTE ON FUNCTION public.get_machine_public(uuid) TO anon, authenticated;

-- 7. Public RPCs powering the anonymous QR pre-start inspection flow
CREATE OR REPLACE FUNCTION public.get_fleet_pre_start_template(_machine_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_name text,
  template_version int,
  item_id uuid,
  item_text text,
  item_sort_order int,
  item_severity text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.version, i.id, i.text, i.sort_order, i.severity
  FROM public.machines m
  JOIN public.checklist_templates t
    ON t.organisation_id = m.organisation_id AND t.is_fleet_pre_start = true AND t.status = 'approved'
  JOIN public.checklist_template_items i ON i.template_id = t.id
  WHERE m.id = _machine_id
  ORDER BY i.sort_order
$$;

CREATE OR REPLACE FUNCTION public.get_org_active_drivers_public(_machine_id uuid)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.full_name
  FROM public.drivers d
  JOIN public.machines m ON m.organisation_id = d.organisation_id
  WHERE m.id = _machine_id AND d.status = 'active'
  ORDER BY d.full_name
$$;

GRANT EXECUTE ON FUNCTION public.get_fleet_pre_start_template(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_active_drivers_public(uuid) TO anon, authenticated;
