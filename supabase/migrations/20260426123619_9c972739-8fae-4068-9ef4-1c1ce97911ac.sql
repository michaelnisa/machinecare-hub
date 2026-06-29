
CREATE TABLE IF NOT EXISTS public.machine_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  applies_to TEXT NOT NULL DEFAULT 'any',
  interval_days INTEGER,
  interval_hours NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.machine_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci select" ON public.machine_checklist_items FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "ci insert" ON public.machine_checklist_items FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "ci update" ON public.machine_checklist_items FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "ci delete" ON public.machine_checklist_items FOR DELETE USING (public.machine_in_org(machine_id));

CREATE TRIGGER trg_ci_updated BEFORE UPDATE ON public.machine_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_ci_machine ON public.machine_checklist_items(machine_id, sort_order);

CREATE TABLE IF NOT EXISTS public.checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.machine_checklist_items(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  service_log_id UUID REFERENCES public.service_logs(id) ON DELETE SET NULL,
  completed_by UUID,
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_at_completion NUMERIC,
  notes TEXT
);

ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc select" ON public.checklist_completions FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "cc insert" ON public.checklist_completions FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "cc update" ON public.checklist_completions FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "cc delete" ON public.checklist_completions FOR DELETE USING (public.machine_in_org(machine_id));

CREATE INDEX IF NOT EXISTS idx_cc_item ON public.checklist_completions(checklist_item_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_machine ON public.checklist_completions(machine_id, completed_at DESC);
