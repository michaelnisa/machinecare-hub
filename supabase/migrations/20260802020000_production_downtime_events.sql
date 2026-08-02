-- ============================================================
-- Production downtime breakdown
-- production_kpis.downtime_minutes was a single raw number with
-- no way to say *why* a machine was down or whether it was planned.
-- This adds an optional itemised breakdown per production log so
-- downtime can be Pareto'd by reason and split planned vs unplanned.
-- ============================================================

CREATE TABLE public.production_downtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  production_kpi_id uuid NOT NULL REFERENCES public.production_kpis(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('planned', 'unplanned')),
  reason_code text NOT NULL,
  duration_minutes numeric NOT NULL CHECK (duration_minutes > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_downtime_events TO authenticated;
GRANT ALL ON public.production_downtime_events TO service_role;

ALTER TABLE public.production_downtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pde select" ON public.production_downtime_events FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());
CREATE POLICY "pde insert" ON public.production_downtime_events FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id));
CREATE POLICY "pde update" ON public.production_downtime_events FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id))
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "pde delete" ON public.production_downtime_events FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id));

CREATE INDEX idx_pde_kpi ON public.production_downtime_events(production_kpi_id);
CREATE INDEX idx_pde_org_date ON public.production_downtime_events(organisation_id, record_date);
CREATE INDEX idx_pde_machine_date ON public.production_downtime_events(machine_id, record_date);
