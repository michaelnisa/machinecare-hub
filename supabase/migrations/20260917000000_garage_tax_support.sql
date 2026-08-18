-- Garage tax/VAT support (garage_workshop.md section 36 "Workshop Business
-- Settings" planned this and it was never built — no way today for a
-- VAT-registered workshop to show tax as a line item on an estimate or
-- invoice). Adds an org-level default rate plus a per-document override,
-- and snapshots the rate onto the invoice the same way every other
-- estimate figure is already snapshotted (generate_garage_invoice).

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS default_tax_rate_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.garage_estimates
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.garage_invoices
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.generate_garage_invoice(_job_id uuid)
RETURNS public.garage_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_estimate public.garage_estimates;
  v_invoice public.garage_invoices;
BEGIN
  SELECT organisation_id INTO v_org FROM public.garage_jobs WHERE id = _job_id;
  IF v_org IS NULL OR v_org <> current_org_id() THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT * INTO v_estimate FROM public.garage_estimates
    WHERE job_id = _job_id AND status = 'approved'
    ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.garage_invoices (organisation_id, job_id, estimate_id, labour_cost, other_cost, discount, tax_rate_percent, created_by)
  VALUES (v_org, _job_id, v_estimate.id, COALESCE(v_estimate.labour_cost, 0), COALESCE(v_estimate.other_cost, 0), COALESCE(v_estimate.discount, 0), COALESCE(v_estimate.tax_rate_percent, 0), auth.uid())
  RETURNING * INTO v_invoice;

  IF v_estimate.id IS NOT NULL THEN
    INSERT INTO public.garage_invoice_items (invoice_id, description, quantity, unit_price, unit_cost)
    SELECT v_invoice.id, description, quantity, unit_price, unit_cost
    FROM public.garage_estimate_items WHERE estimate_id = v_estimate.id;
  END IF;

  RETURN v_invoice;
END;
$$;
