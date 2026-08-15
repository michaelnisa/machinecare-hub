-- Workshop/Garage branch Phase 6 (per garage_workshop.md sections 16-19,
-- 24-26): Parts, Stock, Suppliers, Purchases, Low Stock, and Automatic
-- Inventory Consumption.
--
-- Deliberately reuses the Industrial Inventory foundation (inventory_items,
-- stock_balances, stock_transactions, record_stock_transaction, suppliers,
-- purchase_orders/purchase_order_items) rather than building a parallel
-- ledger — every org (garage or industrial) already only sees its own rows
-- via organisation_id RLS, so there is no cross-branch leakage risk, and
-- duplicating an entire second stock ledger would violate section 53 rule 9
-- ("reuse shared infrastructure") for no isolation benefit. What Workshop
-- gets instead is a simpler, garage-specific UI and a couple of additive
-- columns/functions the enterprise flow doesn't need.

-- A garage marks parts up for the customer — the enterprise side only
-- tracks unit_cost (what we paid), never a customer-facing sell price.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS selling_price numeric;

-- Link estimate/invoice lines back to the stocked part they came from, so
-- adding a part to a job can auto-fill price/cost and the ledger stays
-- traceable (sections 17/19).
ALTER TABLE public.garage_estimate_items
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;
ALTER TABLE public.garage_invoice_items
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;

-- ===== Automatic inventory consumption (section 19) =====
-- Adding a stocked part as an estimate line deducts it immediately (from
-- the org's default stock location); removing that line returns it. This
-- is the "mechanic adds Brake Pad x2" moment from the spec — estimate
-- items are the one place parts get attached to a job, so this single
-- insert/delete pair covers it without needing separate "issue" UI.
CREATE OR REPLACE FUNCTION public.sync_garage_estimate_item_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_job_id uuid;
  v_location uuid;
  v_estimate_id uuid;
  v_item_id uuid;
  v_quantity numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_estimate_id := NEW.estimate_id; v_item_id := NEW.item_id; v_quantity := NEW.quantity;
  ELSE
    v_estimate_id := OLD.estimate_id; v_item_id := OLD.item_id; v_quantity := OLD.quantity;
  END IF;

  IF v_item_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN RETURN NEW; ELSE RETURN OLD; END IF;
  END IF;

  SELECT organisation_id, job_id INTO v_org, v_job_id FROM public.garage_estimates WHERE id = v_estimate_id;
  SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = v_org AND is_default = true LIMIT 1;
  IF v_location IS NULL THEN
    IF TG_OP = 'INSERT' THEN RETURN NEW; ELSE RETURN OLD; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_stock_transaction(
      v_item_id, v_location, 'issue', -v_quantity, 'Added to job estimate',
      NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
    );
  ELSE
    PERFORM public.record_stock_transaction(
      v_item_id, v_location, 'return', v_quantity, 'Removed from job estimate',
      NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
    );
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; ELSE RETURN OLD; END IF;
END;
$$;

CREATE TRIGGER trg_sync_garage_estimate_item_stock_insert
AFTER INSERT ON public.garage_estimate_items
FOR EACH ROW EXECUTE FUNCTION public.sync_garage_estimate_item_stock();

CREATE TRIGGER trg_sync_garage_estimate_item_stock_delete
AFTER DELETE ON public.garage_estimate_items
FOR EACH ROW EXECUTE FUNCTION public.sync_garage_estimate_item_stock();

-- ===== Purchases (section 25): "keep purchasing simple" — one step,
-- optionally already received, instead of the enterprise PR-approval
-- threshold-PO-quarantine pipeline. Reuses purchase_orders/
-- purchase_order_items so Reports/Suppliers spend already work unchanged. =====
CREATE OR REPLACE FUNCTION public.record_garage_purchase(
  _supplier_id uuid,
  _items jsonb, -- [{item_id, item_description, quantity, unit_price}]
  _received boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_location uuid;
  v_po_id uuid;
  v_item jsonb;
BEGIN
  SELECT organisation_id INTO v_org FROM public.suppliers WHERE id = _supplier_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Add at least one item'; END IF;

  INSERT INTO public.purchase_orders (organisation_id, supplier_id, status, created_by)
  VALUES (v_org, _supplier_id, CASE WHEN _received THEN 'received' ELSE 'sent' END, auth.uid())
  RETURNING id INTO v_po_id;

  IF _received THEN
    SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = v_org AND is_default = true LIMIT 1;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.purchase_order_items (purchase_order_id, item_id, item_description, quantity, unit_price, quantity_received)
    VALUES (
      v_po_id,
      NULLIF(v_item->>'item_id', '')::uuid,
      v_item->>'item_description',
      (v_item->>'quantity')::numeric,
      COALESCE((v_item->>'unit_price')::numeric, 0),
      CASE WHEN _received THEN (v_item->>'quantity')::numeric ELSE 0 END
    );

    IF _received AND v_location IS NOT NULL AND (v_item->>'item_id') IS NOT NULL AND v_item->>'item_id' <> '' THEN
      PERFORM public.record_stock_transaction(
        (v_item->>'item_id')::uuid, v_location, 'purchase', (v_item->>'quantity')::numeric,
        'Purchase received', NULL, NULL, 'purchase_order:' || v_po_id::text, false, 'physical_stock'
      );
    END IF;
  END LOOP;

  RETURN v_po_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_garage_purchase(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_garage_purchase(uuid, jsonb, boolean) TO authenticated;
