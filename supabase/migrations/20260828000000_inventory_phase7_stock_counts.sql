-- Inventory module Phase 7 (per Inventory_New.md sections 37/39/44):
-- Stock Counts / Stocktake, and the configurable variance-approval
-- threshold that gates applying one. Inventory History and Reports (the
-- rest of Phase 7) are read-only views over the existing stock_transactions
-- ledger and don't need new tables — built directly in the frontend.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS stock_count_variance_approval_threshold numeric;

-- ===== Stock Counts (header) =====
CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  count_type text NOT NULL DEFAULT 'cycle', -- full | cycle | category | location | critical_spares
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  category text,
  status text NOT NULL DEFAULT 'draft', -- draft | submitted | applied | cancelled
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  applied_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT ALL ON public.stock_counts TO service_role;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_counts_status ON public.stock_counts(organisation_id, status);

CREATE POLICY "sc select" ON public.stock_counts FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sc insert" ON public.stock_counts FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
-- Status transitions (submit/cancel) go through this same UPDATE policy;
-- applying goes through apply_stock_count() below so the variance-threshold
-- gate can't be bypassed by just flipping status via a client-side update.
CREATE POLICY "sc update" ON public.stock_counts FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sc delete" ON public.stock_counts FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND status = 'draft' AND can_write(organisation_id));

CREATE OR REPLACE FUNCTION public.stock_count_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stock_counts WHERE id = _id AND organisation_id = current_org_id())
$$;

-- Block editing status straight to 'applied' from the client — only
-- apply_stock_count() (SECURITY DEFINER, enforces the variance gate) may do
-- that transition.
CREATE OR REPLACE FUNCTION public.block_direct_stock_count_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'applied' AND OLD.status IS DISTINCT FROM 'applied'
     AND COALESCE(current_setting('machinecare.applying_count', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Use apply_stock_count() to apply a count';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_block_direct_stock_count_apply
BEFORE UPDATE ON public.stock_counts
FOR EACH ROW EXECUTE FUNCTION public.block_direct_stock_count_apply();

-- ===== Stock Count Lines =====
CREATE TABLE public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  expected_quantity numeric NOT NULL DEFAULT 0,
  physical_quantity numeric,
  variance numeric GENERATED ALWAYS AS (physical_quantity - expected_quantity) STORED,
  reason text,
  counted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  counted_at timestamptz,
  UNIQUE (stock_count_id, item_id, location_id),
  CHECK (physical_quantity IS NULL OR physical_quantity = expected_quantity OR reason IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_items TO authenticated;
GRANT ALL ON public.stock_count_items TO service_role;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_count_items_count ON public.stock_count_items(stock_count_id);

CREATE POLICY "sci select" ON public.stock_count_items FOR SELECT TO authenticated
  USING (stock_count_in_org(stock_count_id));
CREATE POLICY "sci insert" ON public.stock_count_items FOR INSERT TO authenticated
  WITH CHECK (stock_count_in_org(stock_count_id) AND can_write(current_org_id()));
CREATE POLICY "sci update" ON public.stock_count_items FOR UPDATE TO authenticated
  USING (stock_count_in_org(stock_count_id) AND can_write(current_org_id()));
CREATE POLICY "sci delete" ON public.stock_count_items FOR DELETE TO authenticated
  USING (stock_count_in_org(stock_count_id) AND can_write(current_org_id()));

-- Stamp counted_by/counted_at whenever a physical_quantity is (re)entered,
-- so "who counted this line" doesn't have to be tracked by hand.
CREATE OR REPLACE FUNCTION public.stamp_stock_count_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.physical_quantity IS NOT NULL AND NEW.physical_quantity IS DISTINCT FROM OLD.physical_quantity THEN
    NEW.counted_by := auth.uid();
    NEW.counted_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_stamp_stock_count_item
BEFORE UPDATE ON public.stock_count_items
FOR EACH ROW EXECUTE FUNCTION public.stamp_stock_count_item();

-- ===== Apply: post variances to the stock ledger =====
-- Gated by the org's configurable variance-value threshold (section 44/48
-- — "IF stock count variance exceeds configured threshold THEN require
-- manager approval"). No threshold configured is the safe default: every
-- count needs a manager to apply it.
CREATE OR REPLACE FUNCTION public.apply_stock_count(_count_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_status text;
  v_threshold numeric;
  v_variance_value numeric;
  v_line record;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status FROM public.stock_counts WHERE id = _count_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN
    RAISE EXCEPTION 'Stock count not found';
  END IF;
  IF v_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted count can be applied';
  END IF;

  SELECT COALESCE(SUM(ABS(sci.variance) * COALESCE(ii.unit_cost, 0)), 0) INTO v_variance_value
  FROM public.stock_count_items sci
  JOIN public.inventory_items ii ON ii.id = sci.item_id
  WHERE sci.stock_count_id = _count_id;

  SELECT stock_count_variance_approval_threshold INTO v_threshold FROM public.organisations WHERE id = v_org;

  IF v_threshold IS NULL OR v_variance_value > v_threshold THEN
    IF NOT can_manage(v_org) THEN
      RAISE EXCEPTION 'This count''s variance value (%) requires a manager to apply', v_variance_value;
    END IF;
  ELSIF NOT can_write(v_org) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  FOR v_line IN
    SELECT item_id, location_id, variance FROM public.stock_count_items
    WHERE stock_count_id = _count_id AND variance IS NOT NULL AND variance <> 0
  LOOP
    PERFORM public.record_stock_transaction(
      v_line.item_id, v_line.location_id, 'count_adjustment', v_line.variance,
      'Stock count adjustment', NULL, NULL, 'stock_count:' || _count_id::text,
      true, 'physical_stock'
    );
  END LOOP;

  PERFORM set_config('machinecare.applying_count', 'on', true);
  UPDATE public.stock_counts SET status = 'applied', applied_by = auth.uid(), applied_at = now() WHERE id = _count_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stock_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_stock_count(uuid) TO authenticated;
