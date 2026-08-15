-- Inventory module Phase 1 (per Inventory_New.md): Item Master, Stock
-- Locations, Bin Management, and a proper multi-field stock model
-- (physical/reserved/quarantine/damaged/on_order) backed by an immutable
-- transaction ledger, replacing the single inventory_items.quantity field
-- as the source of truth. inventory_items.quantity is kept as a
-- denormalized total (SUM of physical_stock across locations) so existing
-- reads (Inventory.tsx list, low-stock checks) keep working unchanged.

-- ===== Item Master: extend inventory_items =====
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS manufacturer_part_number text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'spare_part', -- spare_part | consumable | raw_material | production_material | tool | ppe | safety_equipment | chemical | lubricant | electrical_component | mechanical_component | other
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'low', -- low | medium | high | critical
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active', -- active | inactive | discontinued
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS technical_specs text,
  ADD COLUMN IF NOT EXISTS max_stock numeric,
  ADD COLUMN IF NOT EXISTS reorder_quantity numeric,
  ADD COLUMN IF NOT EXISTS safety_stock numeric,
  ADD COLUMN IF NOT EXISTS lead_time_days int,
  ADD COLUMN IF NOT EXISTS avg_monthly_consumption numeric,
  ADD COLUMN IF NOT EXISTS backup_supplier text;

CREATE INDEX IF NOT EXISTS idx_inventory_items_criticality ON public.inventory_items(organisation_id, criticality);
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_type ON public.inventory_items(organisation_id, item_type);

-- ===== Stock Locations =====
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  site text,
  building text,
  area text,
  manager uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active', -- active | inactive
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sl select" ON public.stock_locations FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sl insert" ON public.stock_locations FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sl update" ON public.stock_locations FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sl delete" ON public.stock_locations FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- One default "Main Store" per existing org so item balances have somewhere to live.
INSERT INTO public.stock_locations (organisation_id, name, status, is_default)
SELECT id, 'Main Store', 'active', true FROM public.organisations
ON CONFLICT DO NOTHING;

-- ===== Stock Balances (per item, per location, with bin) =====
CREATE TABLE public.stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  bin text, -- e.g. "A3-B-4-07" (aisle-rack-shelf-bin)
  physical_stock numeric NOT NULL DEFAULT 0,
  reserved_stock numeric NOT NULL DEFAULT 0,
  quarantine_stock numeric NOT NULL DEFAULT 0,
  damaged_stock numeric NOT NULL DEFAULT 0,
  on_order_stock numeric NOT NULL DEFAULT 0,
  available_stock numeric GENERATED ALWAYS AS (physical_stock - reserved_stock - quarantine_stock - damaged_stock) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_balances TO authenticated;
GRANT ALL ON public.stock_balances TO service_role;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_balances_item ON public.stock_balances(item_id);
CREATE INDEX idx_stock_balances_location ON public.stock_balances(location_id);

CREATE POLICY "sb select" ON public.stock_balances FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sb insert" ON public.stock_balances FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sb update" ON public.stock_balances FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sb delete" ON public.stock_balances FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Seed balances for existing items from their current quantity, into each
-- org's default location.
INSERT INTO public.stock_balances (organisation_id, item_id, location_id, physical_stock)
SELECT i.organisation_id, i.id, l.id, COALESCE(i.quantity, 0)
FROM public.inventory_items i
JOIN public.stock_locations l ON l.organisation_id = i.organisation_id AND l.is_default = true
ON CONFLICT (item_id, location_id) DO NOTHING;

-- Keep inventory_items.quantity as a denormalized total so every existing
-- read path (low-stock badges, ServiceLogDialog picker, PPE stock link)
-- keeps working without modification.
CREATE OR REPLACE FUNCTION public.sync_inventory_item_quantity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item uuid := COALESCE(NEW.item_id, OLD.item_id);
BEGIN
  UPDATE public.inventory_items
  SET quantity = COALESCE((SELECT SUM(physical_stock) FROM public.stock_balances WHERE item_id = v_item), 0)
  WHERE id = v_item;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_inventory_item_quantity
AFTER INSERT OR UPDATE OF physical_stock OR DELETE ON public.stock_balances
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_item_quantity();

-- ===== Stock Transactions (immutable ledger) =====
CREATE TABLE public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL, -- transfers only
  transaction_type text NOT NULL, -- receipt | issue | return | transfer | reservation | release | adjustment | damage | scrap | consumption | purchase | count_adjustment
  quantity numeric NOT NULL,
  balance_after numeric,
  reason text,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  reference text,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT ALL ON public.stock_transactions TO service_role;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_transactions_item ON public.stock_transactions(item_id, created_at DESC);
CREATE INDEX idx_stock_transactions_wo ON public.stock_transactions(work_order_id);
CREATE INDEX idx_stock_transactions_machine ON public.stock_transactions(machine_id);

CREATE POLICY "st select" ON public.stock_transactions FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "st insert" ON public.stock_transactions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
-- No update/delete policy: the ledger is immutable by design (corrections
-- are new "adjustment" transactions, per Inventory_New.md section 55).

-- Atomic, row-locked stock mutation: the single path every issue / return /
-- transfer / adjustment / receipt goes through, so two users can't issue the
-- last unit at the same time and stock never goes negative unless
-- explicitly allowed by _allow_negative.
CREATE OR REPLACE FUNCTION public.record_stock_transaction(
  _item_id uuid,
  _location_id uuid,
  _transaction_type text,
  _quantity numeric, -- signed: positive increases physical_stock, negative decreases it (issue/consumption/scrap/damage should be passed negative)
  _reason text DEFAULT NULL,
  _work_order_id uuid DEFAULT NULL,
  _machine_id uuid DEFAULT NULL,
  _reference text DEFAULT NULL,
  _allow_negative boolean DEFAULT false
)
RETURNS public.stock_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_new_physical numeric;
  v_txn public.stock_transactions;
BEGIN
  SELECT organisation_id INTO v_org FROM public.inventory_items WHERE id = _item_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF NOT can_write(v_org) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  INSERT INTO public.stock_balances (organisation_id, item_id, location_id)
    VALUES (v_org, _item_id, _location_id)
    ON CONFLICT (item_id, location_id) DO NOTHING;

  -- Row lock so concurrent issues against the same balance serialize.
  PERFORM 1 FROM public.stock_balances WHERE item_id = _item_id AND location_id = _location_id FOR UPDATE;

  UPDATE public.stock_balances
  SET physical_stock = physical_stock + _quantity,
      updated_at = now()
  WHERE item_id = _item_id AND location_id = _location_id
  RETURNING physical_stock INTO v_new_physical;

  IF v_new_physical < 0 AND NOT _allow_negative THEN
    RAISE EXCEPTION 'This would take stock negative (%) — not allowed', v_new_physical;
  END IF;

  INSERT INTO public.stock_transactions
    (organisation_id, item_id, location_id, transaction_type, quantity, balance_after, reason, work_order_id, machine_id, reference, performed_by)
  VALUES
    (v_org, _item_id, _location_id, _transaction_type, _quantity, v_new_physical, _reason, _work_order_id, _machine_id, _reference, auth.uid())
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_stock_transaction(uuid, uuid, text, numeric, text, uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_transaction(uuid, uuid, text, numeric, text, uuid, uuid, text, boolean) TO authenticated;
