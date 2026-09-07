-- ============================================================
-- Production & Manufacturing Enhancements
-- 1. Formal Production Lines & Work Center Mapping
-- 2. Link Production Orders to Products, Lines, Batches, & QC
-- 3. Link Production Shift KPIs to Production Orders with Auto-Progress
-- 4. Finished Goods Stock Intake & Inventory Integration
-- 5. Quality Reports Linkage to Production Orders & Batches
-- ============================================================

-- 1. Production Lines
CREATE TABLE IF NOT EXISTS public.production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  rated_units_per_hour numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;
GRANT ALL ON public.production_lines TO service_role;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pl select" ON public.production_lines;
CREATE POLICY "pl select" ON public.production_lines FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "pl insert" ON public.production_lines;
CREATE POLICY "pl insert" ON public.production_lines FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "pl update" ON public.production_lines;
CREATE POLICY "pl update" ON public.production_lines FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "pl delete" ON public.production_lines;
CREATE POLICY "pl delete" ON public.production_lines FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE INDEX IF NOT EXISTS idx_prod_lines_org ON public.production_lines(organisation_id, is_active);

-- Production Line Machines (Work Centers sequence)
CREATE TABLE IF NOT EXISTS public.production_line_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.production_lines(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL DEFAULT 1,
  is_bottleneck boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_id, machine_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_line_machines TO authenticated;
GRANT ALL ON public.production_line_machines TO service_role;
ALTER TABLE public.production_line_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plm select" ON public.production_line_machines;
CREATE POLICY "plm select" ON public.production_line_machines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_lines l WHERE l.id = line_id AND l.organisation_id = current_org_id()));

DROP POLICY IF EXISTS "plm insert" ON public.production_line_machines;
CREATE POLICY "plm insert" ON public.production_line_machines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_lines l WHERE l.id = line_id AND l.organisation_id = current_org_id() AND can_write(l.organisation_id)));

DROP POLICY IF EXISTS "plm update" ON public.production_line_machines;
CREATE POLICY "plm update" ON public.production_line_machines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_lines l WHERE l.id = line_id AND l.organisation_id = current_org_id() AND can_write(l.organisation_id)));

DROP POLICY IF EXISTS "plm delete" ON public.production_line_machines;
CREATE POLICY "plm delete" ON public.production_line_machines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_lines l WHERE l.id = line_id AND l.organisation_id = current_org_id() AND can_manage(l.organisation_id)));

CREATE INDEX IF NOT EXISTS idx_plm_line ON public.production_line_machines(line_id, sequence_order);

-- 2. Alter Production Orders
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS production_line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qc_status text DEFAULT 'pending_qc'
    CHECK (qc_status IN ('pending_qc', 'passed', 'quarantined'));

CREATE INDEX IF NOT EXISTS idx_prod_orders_product ON public.production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_batch ON public.production_orders(batch_number);

-- 3. Alter Production Shift KPIs
ALTER TABLE public.production_kpis
  ADD COLUMN IF NOT EXISTS production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS production_line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_kpis_order ON public.production_kpis(production_order_id);

-- 4. Alter Production Plans
ALTER TABLE public.production_plans
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_line_id uuid REFERENCES public.production_lines(id) ON DELETE SET NULL;

-- 5. Alter Products: finished goods mapping
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS finished_good_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;

-- 6. Alter Quality Reports: link to production orders and batches
ALTER TABLE public.quality_reports
  ADD COLUMN IF NOT EXISTS production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number text;

CREATE INDEX IF NOT EXISTS idx_qr_order ON public.quality_reports(production_order_id);

-- 7. Trigger: Auto-sync Production Order progress when KPIs are logged
CREATE OR REPLACE FUNCTION public.trg_sync_production_order_progress()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total_produced numeric;
  v_current_status text;
BEGIN
  v_order_id := COALESCE(NEW.production_order_id, OLD.production_order_id);
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(actual_units), 0)
  INTO v_total_produced
  FROM public.production_kpis
  WHERE production_order_id = v_order_id;

  SELECT status INTO v_current_status
  FROM public.production_orders
  WHERE id = v_order_id;

  UPDATE public.production_orders
  SET
    quantity_produced = v_total_produced,
    status = CASE
      WHEN v_current_status IN ('planned', 'released') AND v_total_produced > 0 THEN 'in_progress'
      ELSE status
    END,
    actual_start_date = CASE
      WHEN actual_start_date IS NULL AND v_total_produced > 0 THEN CURRENT_DATE
      ELSE actual_start_date
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_production_kpis_sync_order ON public.production_kpis;
CREATE TRIGGER trg_production_kpis_sync_order
AFTER INSERT OR UPDATE OR DELETE ON public.production_kpis
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_production_order_progress();

-- 8. RPC: Receive Finished Goods for Production Order into Inventory
CREATE OR REPLACE FUNCTION public.receive_finished_goods_for_order(
  _order_id uuid,
  _quantity numeric,
  _location_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.production_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_item_id uuid;
  v_loc_id uuid;
  v_txn public.stock_transactions;
BEGIN
  SELECT * INTO v_order FROM public.production_orders WHERE id = _order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  IF NOT can_write(v_order.organisation_id) THEN
    RAISE EXCEPTION 'Not authorized to record stock receipt';
  END IF;

  IF _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  -- Find item to credit: product's finished_good_item_id or search item by product SKU / name
  IF v_order.product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM public.products WHERE id = v_order.product_id;
    v_item_id := v_product.finished_good_item_id;
  END IF;

  IF v_item_id IS NULL THEN
    -- Fallback: check if an inventory item has the same name or SKU in this org
    SELECT id INTO v_item_id
    FROM public.inventory_items
    WHERE organisation_id = v_order.organisation_id
      AND (
        (v_product.sku IS NOT NULL AND part_number = v_product.sku)
        OR name ILIKE v_order.product
      )
    LIMIT 1;
  END IF;

  IF v_item_id IS NULL THEN
    -- Create a finished good inventory item automatically so inventory is never lost
    INSERT INTO public.inventory_items (
      organisation_id,
      name,
      part_number,
      category,
      unit,
      quantity,
      unit_cost
    ) VALUES (
      v_order.organisation_id,
      v_order.product,
      COALESCE(v_product.sku, 'FG-' || UPPER(SUBSTRING(v_order.product FROM 1 FOR 4))),
      'finished_goods',
      'pcs',
      0,
      0
    ) RETURNING id INTO v_item_id;

    IF v_order.product_id IS NOT NULL THEN
      UPDATE public.products SET finished_good_item_id = v_item_id WHERE id = v_order.product_id;
    END IF;
  END IF;

  -- Resolve destination stock location
  v_loc_id := _location_id;
  IF v_loc_id IS NULL THEN
    SELECT id INTO v_loc_id
    FROM public.stock_locations
    WHERE organisation_id = v_order.organisation_id AND is_default = true
    LIMIT 1;
  END IF;

  IF v_loc_id IS NULL THEN
    SELECT id INTO v_loc_id
    FROM public.stock_locations
    WHERE organisation_id = v_order.organisation_id
    LIMIT 1;
  END IF;

  -- Record stock transaction (receipt)
  v_txn := public.record_stock_transaction(
    v_item_id,
    v_loc_id,
    'receipt',
    _quantity,
    COALESCE(_notes, 'Finished goods produced from order ' || COALESCE('PO-' || v_order.po_year || '-' || LPAD(v_order.po_number::text, 4, '0'), v_order.id::text)),
    NULL,
    NULL,
    'production_order:' || v_order.id::text,
    true
  );

  -- Mark production order completed
  UPDATE public.production_orders
  SET
    status = 'completed',
    actual_end_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = v_order.id;

  RETURN v_txn.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_finished_goods_for_order(uuid, numeric, uuid, text) TO authenticated;
