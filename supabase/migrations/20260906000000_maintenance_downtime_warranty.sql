-- Maintenance module additions: warranty tracking on machines, and a
-- dedicated breakdown/downtime event log (machine-owned, distinct from
-- production_kpis' shift-level downtime_minutes, which is production's
-- own aggregate and not meant to carry root-cause detail per incident).

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS warranty_expiry date,
  ADD COLUMN IF NOT EXISTS warranty_provider text;

CREATE TABLE public.machine_downtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'breakdown', -- breakdown | electrical | mechanical | operator_error | no_parts | other
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_downtime_events TO authenticated;
GRANT ALL ON public.machine_downtime_events TO service_role;
ALTER TABLE public.machine_downtime_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_machine_downtime_events_machine ON public.machine_downtime_events(machine_id, started_at DESC);
CREATE INDEX idx_machine_downtime_events_org_open ON public.machine_downtime_events(organisation_id) WHERE ended_at IS NULL;

CREATE POLICY "mde select" ON public.machine_downtime_events FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "mde insert" ON public.machine_downtime_events FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "mde update" ON public.machine_downtime_events FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "mde delete" ON public.machine_downtime_events FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));
