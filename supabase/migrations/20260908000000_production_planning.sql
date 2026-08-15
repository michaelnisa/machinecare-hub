-- Production Planning (Phase 2 of the Production module): set targets ahead
-- of time per line/shift/product, so production_kpis logging has something
-- to compare "actual" against besides a number typed in on the day.

CREATE TABLE public.production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  production_line text,
  shift text,
  product text,
  target_units numeric NOT NULL DEFAULT 0,
  planned_minutes numeric,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_plans TO authenticated;
GRANT ALL ON public.production_plans TO service_role;
ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_production_plans_org_date ON public.production_plans(organisation_id, plan_date);

CREATE POLICY "pp select" ON public.production_plans FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "pp insert" ON public.production_plans FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pp update" ON public.production_plans FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pp delete" ON public.production_plans FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER production_plans_set_updated_at
  BEFORE UPDATE ON public.production_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
