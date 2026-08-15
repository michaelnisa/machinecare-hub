-- Inventory module Phase 6 (per Inventory_New.md sections 20/43/51-52):
-- Production Material Integration — a per-product Bill of Materials, so
-- MachineCare can calculate material requirements from a production plan,
-- detect shortages against available/on-order stock, and auto-record
-- consumption against the immutable stock ledger as production is logged.

-- ===== Bill of Materials: which inventory items a product consumes =====
CREATE TABLE public.product_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty_per_unit numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT ALL ON public.product_materials TO service_role;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_product_materials_product ON public.product_materials(product_id);
CREATE INDEX idx_product_materials_item ON public.product_materials(item_id);

CREATE POLICY "pm select" ON public.product_materials FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "pm insert" ON public.product_materials FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pm update" ON public.product_materials FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pm delete" ON public.product_materials FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Auto-consumption: actual_units logged against a product with a BOM
-- consumes stock automatically, from the org's default stock location, and
-- is recorded on the same immutable ledger as every other movement
-- (reference 'production_kpi:<id>' ties it back to the shift log). Runs off
-- the delta between old and new actual_units so editing a log corrects
-- consumption instead of double-counting it. Negative stock is allowed here
-- (unlike a manual issue) because this reflects what was physically used —
-- blocking the production log because inventory records are out of sync
-- would be worse than a variance to investigate later.
CREATE OR REPLACE FUNCTION public.consume_production_materials(_kpi_id uuid, _org uuid, _product_id uuid, _machine_id uuid, _delta_units numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_location uuid;
  v_line record;
BEGIN
  IF _delta_units = 0 THEN RETURN; END IF;

  SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = _org AND is_default = true LIMIT 1;
  IF v_location IS NULL THEN RETURN; END IF;

  FOR v_line IN SELECT item_id, qty_per_unit FROM public.product_materials WHERE product_id = _product_id LOOP
    PERFORM public.record_stock_transaction(
      v_line.item_id, v_location, 'consumption', -(v_line.qty_per_unit * _delta_units),
      'Auto-consumed from production log', NULL, _machine_id, 'production_kpi:' || _kpi_id::text,
      true, 'physical_stock'
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_production_materials(uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_production_materials(uuid, uuid, uuid, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_production_kpis_consume()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.actual_units > 0 THEN
      PERFORM public.consume_production_materials(NEW.id, NEW.organisation_id, NEW.product_id, NEW.machine_id, NEW.actual_units);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.product_id = OLD.product_id AND NEW.actual_units IS DISTINCT FROM OLD.actual_units THEN
    PERFORM public.consume_production_materials(NEW.id, NEW.organisation_id, NEW.product_id, NEW.machine_id, NEW.actual_units - OLD.actual_units);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_production_kpis_consume ON public.production_kpis;
CREATE TRIGGER trg_production_kpis_consume
AFTER INSERT OR UPDATE ON public.production_kpis
FOR EACH ROW EXECUTE FUNCTION public.trg_production_kpis_consume();
