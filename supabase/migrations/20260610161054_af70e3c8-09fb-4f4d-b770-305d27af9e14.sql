
-- Checklist executions header
CREATE TABLE public.checklist_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL DEFAULT 1,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_at_execution NUMERIC,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ce_org_idx ON public.checklist_executions(organisation_id, performed_at DESC);
CREATE INDEX ce_machine_idx ON public.checklist_executions(machine_id, performed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_executions TO authenticated;
GRANT ALL ON public.checklist_executions TO service_role;
ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ce select" ON public.checklist_executions FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ce insert" ON public.checklist_executions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "ce update" ON public.checklist_executions FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND (can_write(current_org_id()) OR performed_by = auth.uid()));
CREATE POLICY "ce delete" ON public.checklist_executions FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(current_org_id()));

CREATE TRIGGER trg_ce_updated BEFORE UPDATE ON public.checklist_executions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Responses per item
CREATE TABLE public.checklist_execution_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.checklist_executions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
  item_text_snapshot TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'pass_fail',
  severity_snapshot TEXT NOT NULL DEFAULT 'minor',
  result TEXT,
  measured_value NUMERIC,
  text_response TEXT,
  photo_url TEXT,
  notes TEXT,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cer_execution_idx ON public.checklist_execution_responses(execution_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_execution_responses TO authenticated;
GRANT ALL ON public.checklist_execution_responses TO service_role;
ALTER TABLE public.checklist_execution_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cer select" ON public.checklist_execution_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id AND e.organisation_id = current_org_id()));
CREATE POLICY "cer insert" ON public.checklist_execution_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id AND e.organisation_id = current_org_id() AND can_write(current_org_id())));
CREATE POLICY "cer update" ON public.checklist_execution_responses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id AND e.organisation_id = current_org_id() AND can_write(current_org_id())));
CREATE POLICY "cer delete" ON public.checklist_execution_responses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id AND e.organisation_id = current_org_id() AND can_manage(current_org_id())));

-- Auto create a work order when a response is marked 'fail' and execution becomes 'completed'
-- Use a function called on execution status change to 'completed'
CREATE OR REPLACE FUNCTION public.autogen_wos_from_execution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  new_wo_id UUID;
  prio TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    FOR r IN
      SELECT * FROM public.checklist_execution_responses
       WHERE execution_id = NEW.id
         AND result = 'fail'
         AND work_order_id IS NULL
    LOOP
      prio := CASE r.severity_snapshot
        WHEN 'critical' THEN 'urgent'
        WHEN 'major' THEN 'high'
        ELSE 'normal'
      END;
      INSERT INTO public.work_orders (organisation_id, machine_id, title, description, priority, status, created_by)
      VALUES (NEW.organisation_id, NEW.machine_id,
              'Checklist failure: ' || left(r.item_text_snapshot, 100),
              COALESCE(r.notes, '') || CASE WHEN r.measured_value IS NOT NULL THEN E'\nMeasured: ' || r.measured_value::text ELSE '' END,
              prio, 'open', NEW.performed_by)
      RETURNING id INTO new_wo_id;
      UPDATE public.checklist_execution_responses SET work_order_id = new_wo_id WHERE id = r.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ce_autogen_wos
AFTER UPDATE ON public.checklist_executions
FOR EACH ROW EXECUTE FUNCTION public.autogen_wos_from_execution();
