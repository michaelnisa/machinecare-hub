-- Customer-facing "where's my car" status link/QR, mirroring the existing
-- get_machine_public() pattern: a single anon-safe SECURITY DEFINER RPC
-- that returns only what a customer needs to see (no line-item detail, no
-- other customers' data, no staff-only fields like diagnosis notes).
-- Uses the job's own id as the link token (same trust model as machine QR
-- — a random gen_random_uuid() primary key, not guessable) rather than
-- adding a separate token column, since a garage job's public page is
-- read-only status, not a write surface like the induction/fault-report
-- QR flows.

CREATE OR REPLACE FUNCTION public.get_garage_job_status_public(_job_id uuid)
RETURNS TABLE (
  job_number int,
  job_year int,
  status text,
  priority text,
  expected_completion date,
  created_at timestamptz,
  organisation_name text,
  vehicle_make text,
  vehicle_model text,
  vehicle_registration text,
  customer_name text,
  mechanic_name text,
  estimate_status text,
  estimate_total numeric,
  estimate_sent_at timestamptz,
  invoice_number int,
  invoice_year int,
  invoice_total numeric,
  invoice_paid numeric,
  invoice_outstanding numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job public.garage_jobs;
  v_est public.garage_estimates;
  v_inv public.garage_invoices;
  v_est_total numeric;
  v_inv_total numeric;
  v_inv_paid numeric;
BEGIN
  PERFORM public.enforce_rate_limit('garage_status:' || _job_id::text, 60, 10);

  SELECT * INTO v_job FROM public.garage_jobs WHERE id = _job_id;
  IF v_job IS NULL THEN RETURN; END IF;

  SELECT * INTO v_est FROM public.garage_estimates WHERE job_id = _job_id ORDER BY created_at DESC LIMIT 1;
  IF v_est.id IS NOT NULL THEN
    SELECT COALESCE(SUM(line_total), 0) INTO v_est_total FROM public.garage_estimate_items WHERE estimate_id = v_est.id;
    v_est_total := (v_est_total + COALESCE(v_est.labour_cost, 0) + COALESCE(v_est.other_cost, 0) - COALESCE(v_est.discount, 0))
                   * (1 + COALESCE(v_est.tax_rate_percent, 0) / 100);
  END IF;

  SELECT * INTO v_inv FROM public.garage_invoices WHERE job_id = _job_id;
  IF v_inv.id IS NOT NULL THEN
    SELECT COALESCE(SUM(line_total), 0) INTO v_inv_total FROM public.garage_invoice_items WHERE invoice_id = v_inv.id;
    v_inv_total := (v_inv_total + COALESCE(v_inv.labour_cost, 0) + COALESCE(v_inv.other_cost, 0) - COALESCE(v_inv.discount, 0))
                   * (1 + COALESCE(v_inv.tax_rate_percent, 0) / 100);
    SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0) INTO v_inv_paid
    FROM public.garage_payments WHERE invoice_id = v_inv.id;
  END IF;

  RETURN QUERY SELECT
    v_job.job_number, v_job.job_year, v_job.status, v_job.priority,
    v_job.expected_completion, v_job.created_at,
    (SELECT o.name FROM public.organisations o WHERE o.id = v_job.organisation_id),
    (SELECT v.make FROM public.garage_vehicles v WHERE v.id = v_job.vehicle_id),
    (SELECT v.model FROM public.garage_vehicles v WHERE v.id = v_job.vehicle_id),
    (SELECT v.registration_number FROM public.garage_vehicles v WHERE v.id = v_job.vehicle_id),
    (SELECT c.name FROM public.garage_customers c WHERE c.id = v_job.customer_id),
    (SELECT m.name FROM public.garage_mechanics m WHERE m.id = v_job.mechanic_id),
    v_est.status, v_est_total, v_est.sent_at,
    v_inv.invoice_number, v_inv.invoice_year, v_inv_total, v_inv_paid,
    CASE WHEN v_inv.id IS NOT NULL THEN v_inv_total - v_inv_paid END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_garage_job_status_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_garage_job_status_public(uuid) TO anon, authenticated;
