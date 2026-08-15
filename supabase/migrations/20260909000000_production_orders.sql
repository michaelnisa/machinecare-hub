-- Production Orders (Phase 3 of the Production module): a job-order system
-- for production runs — what to produce, how much, on which line, by when —
-- tracked start to finish, mirroring the work_orders numbering pattern
-- (org+year counter -> sequential PO-YYYY-NNNN).
--
-- Named org_prodorder_counters / assign_prodorder_number (not org_po_counters
-- / assign_po_number) because those names are already taken by Inventory's
-- purchase orders (20260825000000_inventory_phase4_purchasing.sql) — "PO"
-- collides between "purchase order" and "production order" here.

CREATE TABLE public.org_prodorder_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);
GRANT ALL ON public.org_prodorder_counters TO service_role;
GRANT SELECT ON public.org_prodorder_counters TO authenticated;
ALTER TABLE public.org_prodorder_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opoc select" ON public.org_prodorder_counters FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  po_number integer,
  po_year integer,
  product text NOT NULL,
  production_line text,
  shift text,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_produced numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'released', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_production_orders_org_status ON public.production_orders(organisation_id, status);

CREATE POLICY "po select" ON public.production_orders FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "po insert" ON public.production_orders FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "po update" ON public.production_orders FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "po delete" ON public.production_orders FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.assign_prodorder_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
  y INT := EXTRACT(year FROM COALESCE(NEW.created_at, now()))::int;
BEGIN
  NEW.po_year := y;
  IF NEW.po_number IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.org_prodorder_counters(organisation_id, year, next_number)
    VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_prodorder_counters
    SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.po_number := n;
  RETURN NEW;
END $$;

CREATE TRIGGER production_orders_assign_number
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_prodorder_number();

CREATE TRIGGER production_orders_set_updated_at
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
