-- Lightweight SKU master with a standard ideal cycle time, so performance
-- loss can be calculated from a picked product instead of re-typed by hand
-- on every log. Managed inline from the Production page (no dedicated route).

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  ideal_cycle_seconds numeric,
  standard_changeover_minutes numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products select" ON public.products FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "products insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "products update" ON public.products FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "products delete" ON public.products FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE INDEX idx_products_org ON public.products(organisation_id, is_active);

ALTER TABLE public.production_kpis
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
