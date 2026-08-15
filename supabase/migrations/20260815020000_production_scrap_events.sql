-- Scrap breakdown by reason, mirroring production_downtime_events
-- (20260802020000_production_downtime_events.sql) so scrap can be Pareto'd
-- by cause instead of tracked as one raw number.

CREATE TABLE public.production_scrap_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  production_kpi_id uuid NOT NULL REFERENCES public.production_kpis(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  reason_code text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_scrap_events TO authenticated;
GRANT ALL ON public.production_scrap_events TO service_role;

ALTER TABLE public.production_scrap_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pse select" ON public.production_scrap_events FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id() AND has_department_access('production'));
CREATE POLICY "pse insert" ON public.production_scrap_events FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "pse update" ON public.production_scrap_events FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id) AND has_department_access('production'))
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "pse delete" ON public.production_scrap_events FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id) AND has_department_access('production'));

CREATE INDEX idx_pse_kpi ON public.production_scrap_events(production_kpi_id);
CREATE INDEX idx_pse_org_date ON public.production_scrap_events(organisation_id, record_date);
CREATE INDEX idx_pse_machine_date ON public.production_scrap_events(machine_id, record_date);
