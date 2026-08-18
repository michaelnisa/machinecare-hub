-- Today issue_material_request_item/return_material_request_item are gated
-- by can_write — the SAME permission a technician has to create their own
-- request. That means a technician could approve-adjacent themselves parts
-- (issue against their own already-approved request) with no inventory
-- staff ever confirming a physical handover. Tighten both to can_manage,
-- matching review_material_request/close_material_request, so only
-- inventory/ops managers can actually move stock out the door — techs and
-- planners can only request.

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
  IF NOT can_manage(v_org) THEN RAISE EXCEPTION 'Only Inventory Manager may issue against a material request'; END IF;
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
  IF NOT can_manage(v_org) THEN RAISE EXCEPTION 'Only Inventory Manager may accept a return against a material request'; END IF;
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
