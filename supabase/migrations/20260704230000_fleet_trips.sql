-- ============================================================
-- PHASE 3: Fleet & Logistics — Trips
-- ============================================================

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  purpose text,
  origin text,
  destination text,
  cargo_description text,
  start_odo numeric,
  end_odo numeric,
  start_at timestamptz,
  end_at timestamptz,
  fuel_used_l numeric,
  cost numeric,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  fuel_log_id uuid REFERENCES public.fuel_logs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view trips"
ON public.trips FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert trips"
ON public.trips FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update trips"
ON public.trips FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org managers can delete trips"
ON public.trips FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE TRIGGER trg_trips_updated
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_trips_org_status ON public.trips(organisation_id, status);
CREATE INDEX idx_trips_machine ON public.trips(machine_id, start_at DESC);
CREATE INDEX idx_trips_driver ON public.trips(driver_id);
