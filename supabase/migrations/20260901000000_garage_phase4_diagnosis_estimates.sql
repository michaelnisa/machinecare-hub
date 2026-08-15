-- Workshop/Garage branch Phase 4 (per garage_workshop.md sections 13/14/15/34):
-- Diagnosis, Estimates/Quotations, recorded Customer Approval, and Service
-- History (the latter is just closed/delivered garage_jobs per vehicle —
-- no new table needed, queried directly from garage_jobs in the UI).

ALTER TABLE public.garage_jobs
  ADD COLUMN IF NOT EXISTS diagnosis_notes text,
  ADD COLUMN IF NOT EXISTS recommended_repair text;

-- ===== Findings (diagnosis detail list, section 13) =====
CREATE TABLE public.garage_job_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  description text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.garage_job_findings TO authenticated;
GRANT ALL ON public.garage_job_findings TO service_role;
ALTER TABLE public.garage_job_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_job_findings_job ON public.garage_job_findings(job_id);

CREATE POLICY "gjf select" ON public.garage_job_findings FOR SELECT TO authenticated
  USING (garage_job_in_org(job_id));
CREATE POLICY "gjf insert" ON public.garage_job_findings FOR INSERT TO authenticated
  WITH CHECK (garage_job_in_org(job_id) AND can_write(current_org_id()));
CREATE POLICY "gjf delete" ON public.garage_job_findings FOR DELETE TO authenticated
  USING (garage_job_in_org(job_id) AND can_write(current_org_id()));

-- ===== Estimates / Quotations (section 14) =====
CREATE TABLE public.garage_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft', -- draft | sent | approved | declined | changes_requested
  labour_cost numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  notes text,
  sent_at timestamptz,
  -- Customer approval record (section 15) — who approved, how, and how much,
  -- so the amount actually agreed to is never ambiguous later.
  approved_amount numeric,
  approval_method text, -- in_person | phone | sms | email | other
  approved_by_name text, -- the customer, who has no login
  approved_by_profile uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- staff who recorded it
  approved_at timestamptz,
  decline_reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_estimates TO authenticated;
GRANT ALL ON public.garage_estimates TO service_role;
ALTER TABLE public.garage_estimates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_estimates_job ON public.garage_estimates(job_id);

CREATE POLICY "ge select" ON public.garage_estimates FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ge insert" ON public.garage_estimates FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ge update" ON public.garage_estimates FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ge delete" ON public.garage_estimates FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_estimates_updated BEFORE UPDATE ON public.garage_estimates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.garage_estimate_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.garage_estimates WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE TABLE public.garage_estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.garage_estimates(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_estimate_items TO authenticated;
GRANT ALL ON public.garage_estimate_items TO service_role;
ALTER TABLE public.garage_estimate_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_estimate_items_estimate ON public.garage_estimate_items(estimate_id);

CREATE POLICY "gei select" ON public.garage_estimate_items FOR SELECT TO authenticated
  USING (garage_estimate_in_org(estimate_id));
CREATE POLICY "gei insert" ON public.garage_estimate_items FOR INSERT TO authenticated
  WITH CHECK (garage_estimate_in_org(estimate_id) AND can_write(current_org_id()));
CREATE POLICY "gei update" ON public.garage_estimate_items FOR UPDATE TO authenticated
  USING (garage_estimate_in_org(estimate_id) AND can_write(current_org_id()));
CREATE POLICY "gei delete" ON public.garage_estimate_items FOR DELETE TO authenticated
  USING (garage_estimate_in_org(estimate_id) AND can_write(current_org_id()));

-- Recording approval/decline is a distinct, higher-trust action from normal
-- estimate edits (it's the customer-trust/dispute-prevention record per
-- section 15) — validate the required fields are actually present instead
-- of trusting the client to have filled them in.
CREATE OR REPLACE FUNCTION public.enforce_garage_estimate_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.approved_amount IS NULL OR NEW.approval_method IS NULL OR NEW.approved_by_name IS NULL THEN
      RAISE EXCEPTION 'Approval requires an amount, method, and who approved it';
    END IF;
    NEW.approved_by_profile := auth.uid();
    NEW.approved_at := now();
  ELSIF NEW.status = 'declined' AND OLD.status IS DISTINCT FROM 'declined' THEN
    NEW.approved_by_profile := auth.uid();
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_garage_estimate_decision
BEFORE UPDATE ON public.garage_estimates
FOR EACH ROW EXECUTE FUNCTION public.enforce_garage_estimate_decision();
