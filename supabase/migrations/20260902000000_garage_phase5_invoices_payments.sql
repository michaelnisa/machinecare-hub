-- Workshop/Garage branch Phase 5 (per garage_workshop.md sections 20/27/28/33):
-- Invoices, Payments, and Job costing/profitability.

-- ===== Job costing inputs: cost price per part line, and a catch-all
-- "other cost" bucket on the estimate (section 20's Parts/Labour/Other cost
-- breakdown vs Customer Price). unit_price on an item is what the customer
-- is charged; unit_cost is what it cost the workshop — the gap is margin.
ALTER TABLE public.garage_estimate_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.garage_estimates
  ADD COLUMN IF NOT EXISTS other_cost numeric NOT NULL DEFAULT 0;

-- ===== Invoice numbering: INV-2026-0001, per org per year =====
CREATE TABLE public.org_invoice_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);
GRANT SELECT ON public.org_invoice_counters TO authenticated;
GRANT ALL ON public.org_invoice_counters TO service_role;
ALTER TABLE public.org_invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oic select" ON public.org_invoice_counters FOR SELECT TO authenticated USING (organisation_id = current_org_id());

-- ===== Invoices — a snapshot, not a live view of the estimate (section 53
-- rule 13: "never silently alter historical financial records"). Line
-- items are copied in at generation time via generate_garage_invoice()
-- below, so editing the source estimate afterwards never changes an
-- already-issued invoice. =====
CREATE TABLE public.garage_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE RESTRICT,
  estimate_id uuid REFERENCES public.garage_estimates(id) ON DELETE SET NULL,
  invoice_number int,
  invoice_year int,
  labour_cost numeric NOT NULL DEFAULT 0,
  other_cost numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.garage_invoices TO authenticated;
GRANT ALL ON public.garage_invoices TO service_role;
ALTER TABLE public.garage_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_invoices_org ON public.garage_invoices(organisation_id);
CREATE INDEX idx_garage_invoices_job ON public.garage_invoices(job_id);
CREATE UNIQUE INDEX garage_invoices_job_unique ON public.garage_invoices(job_id);
CREATE UNIQUE INDEX garage_invoices_org_invoice_number_idx ON public.garage_invoices(organisation_id, invoice_year, invoice_number);

CREATE POLICY "gi select" ON public.garage_invoices FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gi insert" ON public.garage_invoices FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
-- No update/delete policy: an invoice, once issued, is a financial record.
-- Corrections belong in notes or a fresh invoice, not a silent edit.

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int;
  y int := EXTRACT(year FROM now())::int;
BEGIN
  IF NEW.invoice_number IS NOT NULL THEN RETURN NEW; END IF;
  NEW.invoice_year := y;
  INSERT INTO public.org_invoice_counters(organisation_id, year, next_number) VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_invoice_counters SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.invoice_number := n;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assign_invoice_number BEFORE INSERT ON public.garage_invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

CREATE OR REPLACE FUNCTION public.garage_invoice_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.garage_invoices WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.garage_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.garage_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED
);

GRANT SELECT, INSERT ON public.garage_invoice_items TO authenticated;
GRANT ALL ON public.garage_invoice_items TO service_role;
ALTER TABLE public.garage_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_invoice_items_invoice ON public.garage_invoice_items(invoice_id);

CREATE POLICY "gii select" ON public.garage_invoice_items FOR SELECT TO authenticated
  USING (garage_invoice_in_org(invoice_id));
CREATE POLICY "gii insert" ON public.garage_invoice_items FOR INSERT TO authenticated
  WITH CHECK (garage_invoice_in_org(invoice_id) AND can_write(current_org_id()));

-- Generates an invoice for a job, snapshotting either the job's approved
-- estimate (if one exists) or starting blank so ad-hoc jobs can still be
-- invoiced directly.
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

  INSERT INTO public.garage_invoices (organisation_id, job_id, estimate_id, labour_cost, other_cost, discount, created_by)
  VALUES (v_org, _job_id, v_estimate.id, COALESCE(v_estimate.labour_cost, 0), COALESCE(v_estimate.other_cost, 0), COALESCE(v_estimate.discount, 0), auth.uid())
  RETURNING * INTO v_invoice;

  IF v_estimate.id IS NOT NULL THEN
    INSERT INTO public.garage_invoice_items (invoice_id, description, quantity, unit_price, unit_cost)
    SELECT v_invoice.id, description, quantity, unit_price, unit_cost
    FROM public.garage_estimate_items WHERE estimate_id = v_estimate.id;
  END IF;

  RETURN v_invoice;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_garage_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_garage_invoice(uuid) TO authenticated;

-- ===== Payments — an immutable ledger against an invoice, mirroring how
-- stock_transactions works. Corrections are a new 'refund' row, never an
-- edit or delete of a past payment (section 53 rule 13). =====
CREATE TABLE public.garage_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.garage_invoices(id) ON DELETE RESTRICT,
  type text NOT NULL DEFAULT 'payment', -- payment | refund
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash', -- cash | mobile_money | bank | other
  reference text,
  notes text,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.garage_payments TO authenticated;
GRANT ALL ON public.garage_payments TO service_role;
ALTER TABLE public.garage_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_payments_invoice ON public.garage_payments(invoice_id);
CREATE INDEX idx_garage_payments_org ON public.garage_payments(organisation_id, paid_at DESC);

CREATE POLICY "gp select" ON public.garage_payments FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gp insert" ON public.garage_payments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
