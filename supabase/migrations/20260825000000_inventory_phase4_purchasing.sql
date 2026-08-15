-- Inventory module Phase 4 (per Inventory_New.md): Purchase Requests,
-- Purchase Orders, Suppliers, Goods Receiving, Quarantine.
--
-- Suppliers are a distinct entity from the existing `vendors` table —
-- vendors are outsourced repair shops (vendor_jobs tracks repair work sent
-- out); suppliers sell goods with lead time/payment terms/currency/rating,
-- a different domain, so this does not reuse or extend vendors.

-- ===== Suppliers =====
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  categories text[] NOT NULL DEFAULT '{}',
  payment_terms text,
  currency text NOT NULL DEFAULT 'TZS',
  lead_time_days int,
  rating numeric, -- 1-5, manually set
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup select" ON public.suppliers FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "sup insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sup update" ON public.suppliers FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "sup delete" ON public.suppliers FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Configurable purchase approval thresholds (section 24) =====
-- Amount bands + which department must approve, instead of a hardcoded
-- "manager approves everything" rule. No band matching an amount, or no
-- approver_department set on the matching band, falls back to can_manage.
CREATE TABLE public.purchase_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric, -- NULL = no upper bound
  approver_department text, -- e.g. 'finance'; NULL = owner/manager only
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_approval_rules TO authenticated;
GRANT ALL ON public.purchase_approval_rules TO service_role;
ALTER TABLE public.purchase_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "par select" ON public.purchase_approval_rules FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "par insert" ON public.purchase_approval_rules FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "par update" ON public.purchase_approval_rules FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "par delete" ON public.purchase_approval_rules FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.can_approve_purchase(_org uuid, _amount numeric)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dept text;
BEGIN
  IF can_manage(_org) THEN RETURN true; END IF;
  SELECT approver_department INTO v_dept
  FROM public.purchase_approval_rules
  WHERE organisation_id = _org AND min_amount <= _amount AND (max_amount IS NULL OR _amount < max_amount)
  ORDER BY min_amount DESC LIMIT 1;
  IF v_dept IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organisation_id = _org AND department = v_dept);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_approve_purchase(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_purchase(uuid, numeric) TO authenticated;

-- ===== Purchase Requests =====
CREATE TABLE public.org_pr_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);
GRANT SELECT ON public.org_pr_counters TO authenticated;
GRANT ALL ON public.org_pr_counters TO service_role;
ALTER TABLE public.org_pr_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opc select" ON public.org_pr_counters FOR SELECT TO authenticated USING (organisation_id = current_org_id());

CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  pr_number int,
  pr_year int,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department text,
  reason text,
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high | critical
  required_date date,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  material_request_id uuid REFERENCES public.material_requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | converted_to_po | cancelled
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(organisation_id, status);

CREATE POLICY "pr2 select" ON public.purchase_requests FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "pr2 insert" ON public.purchase_requests FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pr2 update" ON public.purchase_requests FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pr2 delete" ON public.purchase_requests FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.assign_pr_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int;
  y int := EXTRACT(year FROM now())::int;
BEGIN
  IF NEW.pr_number IS NOT NULL THEN RETURN NEW; END IF;
  NEW.pr_year := y;
  INSERT INTO public.org_pr_counters(organisation_id, year, next_number) VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_pr_counters SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.pr_number := n;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assign_pr_number BEFORE INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_pr_number();

CREATE OR REPLACE FUNCTION public.purchase_request_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.purchase_requests WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_description text, -- fallback if not an existing catalog item
  quantity numeric NOT NULL,
  estimated_unit_price numeric,
  preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_request_items TO authenticated;
GRANT ALL ON public.purchase_request_items TO service_role;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_request_items_pr ON public.purchase_request_items(purchase_request_id);

CREATE POLICY "pri select" ON public.purchase_request_items FOR SELECT TO authenticated
  USING (purchase_request_in_org(purchase_request_id));
CREATE POLICY "pri insert" ON public.purchase_request_items FOR INSERT TO authenticated
  WITH CHECK (purchase_request_in_org(purchase_request_id) AND can_write(current_org_id()));
CREATE POLICY "pri update" ON public.purchase_request_items FOR UPDATE TO authenticated
  USING (purchase_request_in_org(purchase_request_id) AND can_write(current_org_id()));
CREATE POLICY "pri delete" ON public.purchase_request_items FOR DELETE TO authenticated
  USING (purchase_request_in_org(purchase_request_id) AND can_write(current_org_id()));

CREATE OR REPLACE FUNCTION public.review_purchase_request(_pr_id uuid, _decision text, _review_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_total numeric;
BEGIN
  SELECT organisation_id INTO v_org FROM public.purchase_requests WHERE id = _pr_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid decision %', _decision; END IF;

  SELECT COALESCE(SUM(quantity * COALESCE(estimated_unit_price, 0)), 0) INTO v_total
  FROM public.purchase_request_items WHERE purchase_request_id = _pr_id;

  IF NOT can_approve_purchase(v_org, v_total) THEN
    RAISE EXCEPTION 'You are not authorized to approve a purchase request of this value';
  END IF;

  UPDATE public.purchase_requests
  SET status = _decision, review_note = _review_note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _pr_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_purchase_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_purchase_request(uuid, text, text) TO authenticated;

-- ===== Purchase Orders =====
CREATE TABLE public.org_po_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);
GRANT SELECT ON public.org_po_counters TO authenticated;
GRANT ALL ON public.org_po_counters TO service_role;
ALTER TABLE public.org_po_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opoc select" ON public.org_po_counters FOR SELECT TO authenticated USING (organisation_id = current_org_id());

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  po_number int,
  po_year int,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_request_id uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'TZS',
  delivery_date date,
  payment_terms text,
  status text NOT NULL DEFAULT 'draft', -- draft | pending_approval | approved | sent | partially_received | received | cancelled | closed
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(organisation_id, status);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

CREATE POLICY "po select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "po insert" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "po update" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "po delete" ON public.purchase_orders FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.assign_po_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int;
  y int := EXTRACT(year FROM now())::int;
BEGIN
  IF NEW.po_number IS NOT NULL THEN RETURN NEW; END IF;
  NEW.po_year := y;
  INSERT INTO public.org_po_counters(organisation_id, year, next_number) VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_po_counters SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.po_number := n;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assign_po_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_po_number();

CREATE OR REPLACE FUNCTION public.purchase_order_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_description text,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_order_items_po ON public.purchase_order_items(purchase_order_id);

CREATE POLICY "poi select" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (purchase_order_in_org(purchase_order_id));
CREATE POLICY "poi insert" ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (purchase_order_in_org(purchase_order_id) AND can_write(current_org_id()));
CREATE POLICY "poi update" ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (purchase_order_in_org(purchase_order_id) AND can_write(current_org_id()));
CREATE POLICY "poi delete" ON public.purchase_order_items FOR DELETE TO authenticated
  USING (purchase_order_in_org(purchase_order_id) AND can_write(current_org_id()));

-- Convert an approved PR into a draft PO, copying its items.
CREATE OR REPLACE FUNCTION public.convert_purchase_request_to_po(
  _pr_id uuid, _supplier_id uuid, _delivery_date date DEFAULT NULL, _payment_terms text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_status text;
  v_po_id uuid;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status FROM public.purchase_requests WHERE id = _pr_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'Only an approved purchase request can be converted to a PO'; END IF;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  INSERT INTO public.purchase_orders (organisation_id, supplier_id, purchase_request_id, delivery_date, payment_terms, status, created_by)
  VALUES (v_org, _supplier_id, _pr_id, _delivery_date, _payment_terms, 'draft', auth.uid())
  RETURNING id INTO v_po_id;

  INSERT INTO public.purchase_order_items (purchase_order_id, item_id, item_description, quantity, unit_price)
  SELECT v_po_id, item_id, item_description, quantity, COALESCE(estimated_unit_price, 0)
  FROM public.purchase_request_items WHERE purchase_request_id = _pr_id;

  UPDATE public.purchase_requests SET status = 'converted_to_po' WHERE id = _pr_id;

  RETURN v_po_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_purchase_request_to_po(uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_purchase_request_to_po(uuid, uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_purchase_order(_po_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_total numeric;
BEGIN
  SELECT organisation_id INTO v_org FROM public.purchase_orders WHERE id = _po_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _decision NOT IN ('approved', 'cancelled') THEN RAISE EXCEPTION 'Invalid decision %', _decision; END IF;

  SELECT COALESCE(SUM(quantity * unit_price * (1 + tax_rate / 100.0)), 0) INTO v_total
  FROM public.purchase_order_items WHERE purchase_order_id = _po_id;

  IF NOT can_approve_purchase(v_org, v_total) THEN
    RAISE EXCEPTION 'You are not authorized to approve a purchase order of this value';
  END IF;

  UPDATE public.purchase_orders
  SET status = _decision, approved_by = auth.uid(), approved_at = now()
  WHERE id = _po_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_purchase_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_purchase_order(uuid, text) TO authenticated;

-- ===== Goods Receiving & Quarantine =====
CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

GRANT SELECT, INSERT ON public.goods_receipts TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_goods_receipts_po ON public.goods_receipts(purchase_order_id);

CREATE POLICY "gr select" ON public.goods_receipts FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gr insert" ON public.goods_receipts FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

CREATE TABLE public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  quantity_received numeric NOT NULL,
  quantity_accepted numeric NOT NULL,
  quantity_rejected numeric NOT NULL DEFAULT 0,
  rejection_reason text,
  quarantined boolean NOT NULL DEFAULT false,
  quarantine_status text -- NULL while not quarantined, else pending | approved | rejected | returned_to_supplier
);

GRANT SELECT, INSERT, UPDATE ON public.goods_receipt_items TO authenticated;
GRANT ALL ON public.goods_receipt_items TO service_role;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_goods_receipt_items_receipt ON public.goods_receipt_items(goods_receipt_id);

CREATE OR REPLACE FUNCTION public.goods_receipt_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.goods_receipts WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE POLICY "gri select" ON public.goods_receipt_items FOR SELECT TO authenticated
  USING (goods_receipt_in_org(goods_receipt_id));
CREATE POLICY "gri insert" ON public.goods_receipt_items FOR INSERT TO authenticated
  WITH CHECK (goods_receipt_in_org(goods_receipt_id) AND can_write(current_org_id()));
CREATE POLICY "gri update" ON public.goods_receipt_items FOR UPDATE TO authenticated
  USING (goods_receipt_in_org(goods_receipt_id) AND can_write(current_org_id()));

-- Record a full goods receipt in one call: header + line items + stock
-- movement (accepted qty goes to quarantine_stock if flagged, else straight
-- to physical_stock/available), and rolls the PO status forward.
CREATE OR REPLACE FUNCTION public.record_goods_receipt(
  _po_id uuid,
  _location_id uuid,
  _items jsonb, -- [{po_item_id, quantity_received, quantity_accepted, quantity_rejected, rejection_reason, quarantined}]
  _notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_receipt_id uuid;
  v_line jsonb;
  v_po_item public.purchase_order_items;
  v_total_qty numeric;
  v_total_received numeric;
BEGIN
  SELECT organisation_id INTO v_org FROM public.purchase_orders WHERE id = _po_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  INSERT INTO public.goods_receipts (organisation_id, purchase_order_id, location_id, received_by, notes)
  VALUES (v_org, _po_id, _location_id, auth.uid(), _notes)
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v_po_item FROM public.purchase_order_items WHERE id = (v_line->>'po_item_id')::uuid AND purchase_order_id = _po_id;
    IF v_po_item IS NULL THEN RAISE EXCEPTION 'PO line item not found'; END IF;

    INSERT INTO public.goods_receipt_items
      (goods_receipt_id, po_item_id, quantity_received, quantity_accepted, quantity_rejected, rejection_reason, quarantined, quarantine_status)
    VALUES (
      v_receipt_id, v_po_item.id,
      (v_line->>'quantity_received')::numeric,
      (v_line->>'quantity_accepted')::numeric,
      COALESCE((v_line->>'quantity_rejected')::numeric, 0),
      v_line->>'rejection_reason',
      COALESCE((v_line->>'quarantined')::boolean, false),
      CASE WHEN COALESCE((v_line->>'quarantined')::boolean, false) THEN 'pending' ELSE NULL END
    );

    IF v_po_item.item_id IS NOT NULL AND (v_line->>'quantity_accepted')::numeric > 0 THEN
      PERFORM public.record_stock_transaction(
        v_po_item.item_id, _location_id, 'receipt', (v_line->>'quantity_accepted')::numeric,
        'Goods received against PO', NULL, NULL, _po_id::text, false,
        CASE WHEN COALESCE((v_line->>'quarantined')::boolean, false) THEN 'quarantine_stock' ELSE 'physical_stock' END
      );
    END IF;

    UPDATE public.purchase_order_items
    SET quantity_received = quantity_received + (v_line->>'quantity_received')::numeric
    WHERE id = v_po_item.id;
  END LOOP;

  SELECT SUM(quantity), SUM(quantity_received) INTO v_total_qty, v_total_received
  FROM public.purchase_order_items WHERE purchase_order_id = _po_id;

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_total_received >= v_total_qty THEN 'received' ELSE 'partially_received' END
  WHERE id = _po_id;

  RETURN v_receipt_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_goods_receipt(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_goods_receipt(uuid, uuid, jsonb, text) TO authenticated;

-- Resolve a quarantined line: approved moves it into available physical
-- stock; rejected/returned_to_supplier leaves it out of available stock for
-- good (it never becomes physical_stock).
CREATE OR REPLACE FUNCTION public.resolve_quarantine_item(_goods_receipt_item_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row record;
  v_org uuid;
  v_location uuid;
BEGIN
  IF _decision NOT IN ('approved', 'rejected', 'returned_to_supplier') THEN
    RAISE EXCEPTION 'Invalid decision %', _decision;
  END IF;

  SELECT gri.*, gr.organisation_id, gr.location_id, poi.item_id
  INTO v_row
  FROM public.goods_receipt_items gri
  JOIN public.goods_receipts gr ON gr.id = gri.goods_receipt_id
  JOIN public.purchase_order_items poi ON poi.id = gri.po_item_id
  WHERE gri.id = _goods_receipt_item_id AND gr.organisation_id = current_org_id();

  IF v_row IS NULL THEN RAISE EXCEPTION 'Quarantine line not found'; END IF;
  IF NOT can_review_safety(v_row.organisation_id) AND NOT can_manage(v_row.organisation_id) THEN
    RAISE EXCEPTION 'Only Inventory Manager or Safety may resolve a quarantine item';
  END IF;
  IF v_row.quarantine_status <> 'pending' THEN RAISE EXCEPTION 'Already resolved'; END IF;

  PERFORM public.record_stock_transaction(
    v_row.item_id, v_row.location_id, 'adjustment', -v_row.quantity_accepted,
    concat('Quarantine resolved: ', _decision), NULL, NULL, _goods_receipt_item_id::text, true, 'quarantine_stock'
  );

  IF _decision = 'approved' THEN
    PERFORM public.record_stock_transaction(
      v_row.item_id, v_row.location_id, 'receipt', v_row.quantity_accepted,
      'Quarantine approved', NULL, NULL, _goods_receipt_item_id::text, false, 'physical_stock'
    );
  END IF;

  UPDATE public.goods_receipt_items SET quarantine_status = _decision WHERE id = _goods_receipt_item_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_quarantine_item(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_quarantine_item(uuid, text) TO authenticated;
