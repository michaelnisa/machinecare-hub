-- ============================================================
-- PHASE 4: Fleet & Logistics — Tyres
-- ============================================================

CREATE TABLE public.tyres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  position text NOT NULL,
  brand text,
  size text,
  serial text,
  fitted_at date,
  fitted_odo numeric,
  removed_at date,
  removed_reason text,
  current_tread_mm numeric,
  target_replace_km numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tyres TO authenticated;
GRANT ALL ON public.tyres TO service_role;

ALTER TABLE public.tyres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view tyres"
ON public.tyres FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert tyres"
ON public.tyres FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update tyres"
ON public.tyres FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org managers can delete tyres"
ON public.tyres FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE TRIGGER trg_tyres_updated
BEFORE UPDATE ON public.tyres
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_tyres_org ON public.tyres(organisation_id);
CREATE INDEX idx_tyres_machine ON public.tyres(machine_id);
CREATE INDEX idx_tyres_machine_active ON public.tyres(machine_id) WHERE removed_at IS NULL;
