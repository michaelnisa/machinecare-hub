-- Inventory module Phase 2 (per Inventory_New.md): Material Requests,
-- Approval, Reservations, Issue, Return, Transfers — built on the Phase 1
-- stock_balances/stock_transactions/record_stock_transaction foundation.

-- ===== Generalize record_stock_transaction to target any balance field =====
-- Phase 1 only ever touched physical_stock. Reservations, quarantine and
-- damage all need to move a different column on the same balance row, so
-- the ledger function gains a _balance_field param (default keeps every
-- existing caller — PPE issue, Stock adjust/receipt — working unchanged,
-- since PostgREST always calls RPCs with named arguments).
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS balance_field text NOT NULL DEFAULT 'physical_stock';

-- Adding a 10th parameter changes the function's signature, which would
-- otherwise leave the old 9-arg version as a separate, ambiguous overload
-- (PostgREST calls RPCs with named arguments, and every param here has a
-- default, so a 9-arg call would match both). Drop it first so there's only
-- ever one overload.
DROP FUNCTION IF EXISTS public.record_stock_transaction(uuid, uuid, text, numeric, text, uuid, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.record_stock_transaction(
  _item_id uuid,
  _location_id uuid,
  _transaction_type text,
  _quantity numeric,
  _reason text DEFAULT NULL,
  _work_order_id uuid DEFAULT NULL,
  _machine_id uuid DEFAULT NULL,
  _reference text DEFAULT NULL,
  _allow_negative boolean DEFAULT false,
  _balance_field text DEFAULT 'physical_stock' -- physical_stock | reserved_stock | quarantine_stock | damaged_stock | on_order_stock
)
RETURNS public.stock_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_new_value numeric;
  v_txn public.stock_transactions;
BEGIN
  IF _balance_field NOT IN ('physical_stock', 'reserved_stock', 'quarantine_stock', 'damaged_stock', 'on_order_stock') THEN
    RAISE EXCEPTION 'Invalid balance field %', _balance_field;
  END IF;

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

  PERFORM 1 FROM public.stock_balances WHERE item_id = _item_id AND location_id = _location_id FOR UPDATE;

  EXECUTE format('UPDATE public.stock_balances SET %I = %I + $1, updated_at = now() WHERE item_id = $2 AND location_id = $3 RETURNING %I', _balance_field, _balance_field, _balance_field)
    INTO v_new_value USING _quantity, _item_id, _location_id;

  IF v_new_value < 0 AND NOT _allow_negative THEN
    RAISE EXCEPTION 'This would take % negative (%) — not allowed', _balance_field, v_new_value;
  END IF;

  IF _balance_field = 'reserved_stock' THEN
    IF (SELECT reserved_stock > physical_stock FROM public.stock_balances WHERE item_id = _item_id AND location_id = _location_id) THEN
      RAISE EXCEPTION 'Cannot reserve more than physical stock on hand';
    END IF;
  END IF;

  INSERT INTO public.stock_transactions
    (organisation_id, item_id, location_id, transaction_type, quantity, balance_after, balance_field, reason, work_order_id, machine_id, reference, performed_by)
  VALUES
    (v_org, _item_id, _location_id, _transaction_type, _quantity, v_new_value, _balance_field, _reason, _work_order_id, _machine_id, _reference, auth.uid())
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_stock_transaction(uuid, uuid, text, numeric, text, uuid, uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_transaction(uuid, uuid, text, numeric, text, uuid, uuid, text, boolean, text) TO authenticated;

-- ===== Transfers =====
CREATE OR REPLACE FUNCTION public.transfer_stock(
  _item_id uuid,
  _from_location_id uuid,
  _to_location_id uuid,
  _quantity numeric,
  _reason text DEFAULT NULL,
  _reference text DEFAULT NULL
)
RETURNS public.stock_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_txn public.stock_transactions;
BEGIN
  IF _quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;
  IF _from_location_id = _to_location_id THEN
    RAISE EXCEPTION 'Source and destination location must differ';
  END IF;

  SELECT organisation_id INTO v_org FROM public.inventory_items WHERE id = _item_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF NOT can_write(v_org) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  PERFORM public.record_stock_transaction(_item_id, _from_location_id, 'transfer', -_quantity, _reason, NULL, NULL, _reference, false, 'physical_stock');
  SELECT public.record_stock_transaction(_item_id, _to_location_id, 'transfer', _quantity, _reason, NULL, NULL, _reference, false, 'physical_stock') INTO v_txn;

  UPDATE public.stock_transactions SET to_location_id = _to_location_id WHERE id = v_txn.id;
  v_txn.to_location_id := _to_location_id;
  RETURN v_txn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text, text) TO authenticated;

-- ===== Material Requests =====
CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | info_requested | purchase_required | issued | partially_issued | closed
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requests TO authenticated;
GRANT ALL ON public.material_requests TO service_role;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_material_requests_wo ON public.material_requests(work_order_id);
CREATE INDEX idx_material_requests_status ON public.material_requests(organisation_id, status);

CREATE POLICY "mr select" ON public.material_requests FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "mr insert" ON public.material_requests FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "mr update" ON public.material_requests FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "mr delete" ON public.material_requests FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.material_request_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.material_requests WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.material_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  quantity_requested numeric NOT NULL,
  quantity_approved numeric,
  quantity_issued numeric NOT NULL DEFAULT 0,
  quantity_returned numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | issued | partially_issued | closed
  notes text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_request_items TO authenticated;
GRANT ALL ON public.material_request_items TO service_role;
ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_material_request_items_request ON public.material_request_items(material_request_id);
CREATE INDEX idx_material_request_items_item ON public.material_request_items(item_id);

CREATE POLICY "mri select" ON public.material_request_items FOR SELECT TO authenticated
  USING (material_request_in_org(material_request_id));
CREATE POLICY "mri insert" ON public.material_request_items FOR INSERT TO authenticated
  WITH CHECK (material_request_in_org(material_request_id) AND can_write(current_org_id()));
CREATE POLICY "mri update" ON public.material_request_items FOR UPDATE TO authenticated
  USING (material_request_in_org(material_request_id) AND can_write(current_org_id()));
CREATE POLICY "mri delete" ON public.material_request_items FOR DELETE TO authenticated
  USING (material_request_in_org(material_request_id) AND can_manage(current_org_id()));

-- Review a request: decision applies to the header, with optional per-item
-- approved-quantity overrides (for "Approve Partial"). Approving reserves
-- stock immediately (section 18) so other requesters can't consume it.
CREATE OR REPLACE FUNCTION public.review_material_request(
  _request_id uuid,
  _decision text, -- approved | rejected | info_requested | purchase_required
  _review_note text DEFAULT NULL,
  _item_approvals jsonb DEFAULT NULL -- [{ "item_row_id": uuid, "quantity_approved": numeric }]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row record;
  v_override jsonb;
  v_qty numeric;
BEGIN
  SELECT organisation_id INTO v_org FROM public.material_requests WHERE id = _request_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT can_manage(v_org) THEN RAISE EXCEPTION 'Only Inventory Manager may review material requests'; END IF;
  IF _decision NOT IN ('approved', 'rejected', 'info_requested', 'purchase_required') THEN
    RAISE EXCEPTION 'Invalid decision %', _decision;
  END IF;

  IF _decision = 'approved' THEN
    FOR v_row IN SELECT * FROM public.material_request_items WHERE material_request_id = _request_id AND status = 'pending' LOOP
      v_qty := v_row.quantity_requested;
      IF _item_approvals IS NOT NULL THEN
        SELECT (elem->>'quantity_approved')::numeric INTO v_qty
        FROM jsonb_array_elements(_item_approvals) elem
        WHERE (elem->>'item_row_id')::uuid = v_row.id;
        v_qty := COALESCE(v_qty, v_row.quantity_requested);
      END IF;
      IF v_qty > 0 THEN
        PERFORM public.record_stock_transaction(
          v_row.item_id, v_row.location_id, 'reservation', v_qty,
          'Reserved on approval of material request', NULL, NULL, _request_id::text, false, 'reserved_stock'
        );
      END IF;
      UPDATE public.material_request_items SET quantity_approved = v_qty, status = 'approved' WHERE id = v_row.id;
    END LOOP;
  ELSE
    UPDATE public.material_request_items SET status = 'rejected' WHERE material_request_id = _request_id AND status = 'pending';
  END IF;

  UPDATE public.material_requests
  SET status = _decision, review_note = _review_note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_material_request(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_material_request(uuid, text, text, jsonb) TO authenticated;

-- Issue: moves stock from reserved+physical into the requester's hands.
CREATE OR REPLACE FUNCTION public.issue_material_request_item(
  _request_item_id uuid,
  _quantity numeric,
  _work_order_id uuid DEFAULT NULL,
  _machine_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item public.material_request_items;
  v_org uuid;
  v_remaining numeric;
BEGIN
  SELECT mri.* INTO v_item FROM public.material_request_items mri
    JOIN public.material_requests mr ON mr.id = mri.material_request_id
    WHERE mri.id = _request_item_id AND mr.organisation_id = current_org_id();
  IF v_item IS NULL THEN RAISE EXCEPTION 'Request item not found'; END IF;
  SELECT organisation_id INTO v_org FROM public.material_requests WHERE id = v_item.material_request_id;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_item.status NOT IN ('approved', 'partially_issued') THEN
    RAISE EXCEPTION 'This item is not approved for issue';
  END IF;

  v_remaining := COALESCE(v_item.quantity_approved, 0) - v_item.quantity_issued;
  IF _quantity <= 0 OR _quantity > v_remaining THEN
    RAISE EXCEPTION 'Cannot issue % — only % remaining on this request', _quantity, v_remaining;
  END IF;

  PERFORM public.record_stock_transaction(v_item.item_id, v_item.location_id, 'issue', -_quantity, 'Issued against material request', _work_order_id, _machine_id, v_item.material_request_id::text, false, 'physical_stock');
  PERFORM public.record_stock_transaction(v_item.item_id, v_item.location_id, 'release', -_quantity, 'Reservation released on issue', NULL, NULL, v_item.material_request_id::text, true, 'reserved_stock');

  UPDATE public.material_request_items
  SET quantity_issued = quantity_issued + _quantity,
      status = CASE WHEN quantity_issued + _quantity >= COALESCE(quantity_approved, 0) THEN 'issued' ELSE 'partially_issued' END
  WHERE id = _request_item_id;

  UPDATE public.material_requests SET status = (
    SELECT CASE
      WHEN bool_and(status = 'issued') FILTER (WHERE status <> 'rejected') THEN 'issued'
      ELSE 'partially_issued'
    END
    FROM public.material_request_items WHERE material_request_id = v_item.material_request_id
  ) WHERE id = v_item.material_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_material_request_item(uuid, numeric, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_material_request_item(uuid, numeric, uuid, uuid) TO authenticated;

-- Return: unused/serviceable goes back to physical (available); damaged/scrap
-- goes to damaged_stock (does not become available again).
CREATE OR REPLACE FUNCTION public.return_material_request_item(
  _request_item_id uuid,
  _quantity numeric,
  _condition text, -- unused | used_serviceable | damaged | scrap
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item public.material_request_items;
  v_org uuid;
BEGIN
  IF _condition NOT IN ('unused', 'used_serviceable', 'damaged', 'scrap') THEN
    RAISE EXCEPTION 'Invalid condition %', _condition;
  END IF;

  SELECT mri.* INTO v_item FROM public.material_request_items mri
    JOIN public.material_requests mr ON mr.id = mri.material_request_id
    WHERE mri.id = _request_item_id AND mr.organisation_id = current_org_id();
  IF v_item IS NULL THEN RAISE EXCEPTION 'Request item not found'; END IF;
  SELECT organisation_id INTO v_org FROM public.material_requests WHERE id = v_item.material_request_id;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _quantity <= 0 OR _quantity > (v_item.quantity_issued - v_item.quantity_returned) THEN
    RAISE EXCEPTION 'Cannot return more than the outstanding issued quantity';
  END IF;

  IF _condition IN ('unused', 'used_serviceable') THEN
    PERFORM public.record_stock_transaction(v_item.item_id, v_item.location_id, 'return', _quantity, COALESCE(_reason, _condition), NULL, NULL, v_item.material_request_id::text, false, 'physical_stock');
  ELSE
    PERFORM public.record_stock_transaction(v_item.item_id, v_item.location_id, _condition, _quantity, COALESCE(_reason, _condition), NULL, NULL, v_item.material_request_id::text, false, 'damaged_stock');
  END IF;

  UPDATE public.material_request_items SET quantity_returned = quantity_returned + _quantity WHERE id = _request_item_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_material_request_item(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_material_request_item(uuid, numeric, text, text) TO authenticated;

-- Close a request: release any leftover reservation (approved but never
-- issued) back to available stock.
CREATE OR REPLACE FUNCTION public.close_material_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row record;
  v_leftover numeric;
BEGIN
  SELECT organisation_id INTO v_org FROM public.material_requests WHERE id = _request_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT can_manage(v_org) THEN RAISE EXCEPTION 'Only Inventory Manager may close a request'; END IF;

  FOR v_row IN SELECT * FROM public.material_request_items WHERE material_request_id = _request_id LOOP
    v_leftover := COALESCE(v_row.quantity_approved, 0) - v_row.quantity_issued;
    IF v_leftover > 0 THEN
      PERFORM public.record_stock_transaction(v_row.item_id, v_row.location_id, 'release', -v_leftover, 'Released on request closure', NULL, NULL, _request_id::text, true, 'reserved_stock');
    END IF;
  END LOOP;

  UPDATE public.material_request_items SET status = 'closed' WHERE material_request_id = _request_id AND status <> 'rejected';
  UPDATE public.material_requests SET status = 'closed' WHERE id = _request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_material_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_material_request(uuid) TO authenticated;
