-- Workshop/Garage P1 & P3 Enhancements:
-- 1. Inventory stock sync on estimate item UPDATE
-- 2. Automatic stock return when estimate is declined or job cancelled
-- 3. Quality control (QC) checks ledger

-- ===== 1. Update trigger on garage_estimate_items =====
CREATE OR REPLACE FUNCTION public.sync_garage_estimate_item_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_job_id uuid;
  v_location uuid;
  v_delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.item_id IS NULL THEN RETURN NEW; END IF;
    SELECT organisation_id, job_id INTO v_org, v_job_id FROM public.garage_estimates WHERE id = NEW.estimate_id;
    SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = v_org AND is_default = true LIMIT 1;
    IF v_location IS NOT NULL THEN
      PERFORM public.record_stock_transaction(
        NEW.item_id, v_location, 'issue', -NEW.quantity, 'Added to job estimate',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.item_id IS NULL THEN RETURN OLD; END IF;
    SELECT organisation_id, job_id INTO v_org, v_job_id FROM public.garage_estimates WHERE id = OLD.estimate_id;
    SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = v_org AND is_default = true LIMIT 1;
    IF v_location IS NOT NULL THEN
      PERFORM public.record_stock_transaction(
        OLD.item_id, v_location, 'return', OLD.quantity, 'Removed from job estimate',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT organisation_id, job_id INTO v_org, v_job_id FROM public.garage_estimates WHERE id = NEW.estimate_id;
    SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = v_org AND is_default = true LIMIT 1;
    IF v_location IS NULL THEN RETURN NEW; END IF;

    -- Case A: Item ID unchanged, quantity changed
    IF OLD.item_id IS NOT NULL AND NEW.item_id IS NOT NULL AND OLD.item_id = NEW.item_id THEN
      v_delta := NEW.quantity - OLD.quantity;
      IF v_delta > 0 THEN
        PERFORM public.record_stock_transaction(
          NEW.item_id, v_location, 'issue', -v_delta, 'Estimate item quantity increased',
          NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
        );
      ELSIF v_delta < 0 THEN
        PERFORM public.record_stock_transaction(
          NEW.item_id, v_location, 'return', abs(v_delta), 'Estimate item quantity decreased',
          NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
        );
      END IF;

    -- Case B: Item changed to another item
    ELSIF OLD.item_id IS NOT NULL AND NEW.item_id IS NOT NULL AND OLD.item_id <> NEW.item_id THEN
      PERFORM public.record_stock_transaction(
        OLD.item_id, v_location, 'return', OLD.quantity, 'Replaced on job estimate',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );
      PERFORM public.record_stock_transaction(
        NEW.item_id, v_location, 'issue', -NEW.quantity, 'Replacement on job estimate',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );

    -- Case C: Formerly stocked, now unlinked
    ELSIF OLD.item_id IS NOT NULL AND NEW.item_id IS NULL THEN
      PERFORM public.record_stock_transaction(
        OLD.item_id, v_location, 'return', OLD.quantity, 'Unlinked from stocked item',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );

    -- Case D: Formerly unlinked, now linked to stock
    ELSIF OLD.item_id IS NULL AND NEW.item_id IS NOT NULL THEN
      PERFORM public.record_stock_transaction(
        NEW.item_id, v_location, 'issue', -NEW.quantity, 'Linked to stocked item',
        NULL, NULL, 'garage_job:' || v_job_id::text, true, 'physical_stock'
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_garage_estimate_item_stock_update ON public.garage_estimate_items;
CREATE TRIGGER trg_sync_garage_estimate_item_stock_update
AFTER UPDATE ON public.garage_estimate_items
FOR EACH ROW EXECUTE FUNCTION public.sync_garage_estimate_item_stock();

-- ===== 2. Return stock on estimate decline or re-issue on un-decline =====
CREATE OR REPLACE FUNCTION public.handle_garage_estimate_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item record;
  v_location uuid;
BEGIN
  SELECT id INTO v_location FROM public.stock_locations WHERE organisation_id = NEW.organisation_id AND is_default = true LIMIT 1;
  IF v_location IS NULL THEN RETURN NEW; END IF;

  -- If status moved to declined, return all items attached
  IF OLD.status <> 'declined' AND NEW.status = 'declined' THEN
    FOR v_item IN
      SELECT item_id, quantity FROM public.garage_estimate_items
      WHERE estimate_id = NEW.id AND item_id IS NOT NULL
    LOOP
      PERFORM public.record_stock_transaction(
        v_item.item_id, v_location, 'return', v_item.quantity, 'Estimate declined by customer',
        NULL, NULL, 'garage_job:' || NEW.job_id::text, true, 'physical_stock'
      );
    END LOOP;

  -- If status was declined and is now reactivated (draft, sent, approved), re-issue items
  ELSIF OLD.status = 'declined' AND NEW.status IN ('draft', 'sent', 'approved') THEN
    FOR v_item IN
      SELECT item_id, quantity FROM public.garage_estimate_items
      WHERE estimate_id = NEW.id AND item_id IS NOT NULL
    LOOP
      PERFORM public.record_stock_transaction(
        v_item.item_id, v_location, 'issue', -v_item.quantity, 'Estimate re-activated',
        NULL, NULL, 'garage_job:' || NEW.job_id::text, true, 'physical_stock'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garage_estimate_status_change ON public.garage_estimates;
CREATE TRIGGER trg_garage_estimate_status_change
AFTER UPDATE OF status ON public.garage_estimates
FOR EACH ROW EXECUTE FUNCTION public.handle_garage_estimate_status_change();

-- ===== 3. Quality Control (QC) Table =====
CREATE TABLE IF NOT EXISTS public.garage_job_qc_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  fluids_checked boolean NOT NULL DEFAULT true,
  wheel_nuts_torqued boolean NOT NULL DEFAULT true,
  dtc_codes_cleared boolean NOT NULL DEFAULT true,
  road_test_passed boolean NOT NULL DEFAULT true,
  old_parts_retained boolean NOT NULL DEFAULT false,
  vehicle_cleaned boolean NOT NULL DEFAULT true,
  inspector_name text,
  inspector_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  passed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.garage_job_qc_checks TO authenticated;
GRANT ALL ON public.garage_job_qc_checks TO service_role;
ALTER TABLE public.garage_job_qc_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_garage_qc_job ON public.garage_job_qc_checks(job_id);

DROP POLICY IF EXISTS "gqc select" ON public.garage_job_qc_checks;
CREATE POLICY "gqc select" ON public.garage_job_qc_checks FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "gqc insert" ON public.garage_job_qc_checks;
CREATE POLICY "gqc insert" ON public.garage_job_qc_checks FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "gqc update" ON public.garage_job_qc_checks;
CREATE POLICY "gqc update" ON public.garage_job_qc_checks FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
