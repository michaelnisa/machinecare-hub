-- Workshop/Garage branch Phase 3 (per garage_workshop.md sections 11/12/21/47):
-- Mechanics and Jobs — Jobs is the central Workshop object every later
-- phase (diagnosis, estimates, invoices, service history) hangs off.

CREATE TABLE public.garage_mechanics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  specialization text, -- free-typed; section 21 says "do not force specialization"
  status text NOT NULL DEFAULT 'active', -- active | inactive
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_mechanics TO authenticated;
GRANT ALL ON public.garage_mechanics TO service_role;
ALTER TABLE public.garage_mechanics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_mechanics_org ON public.garage_mechanics(organisation_id);

CREATE POLICY "gm select" ON public.garage_mechanics FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gm insert" ON public.garage_mechanics FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gm update" ON public.garage_mechanics FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gm delete" ON public.garage_mechanics FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_mechanics_updated BEFORE UPDATE ON public.garage_mechanics
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Job numbering: JOB-2026-0001, per org per year (mirrors org_pr_counters) =====
CREATE TABLE public.org_job_counters (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, year)
);
GRANT SELECT ON public.org_job_counters TO authenticated;
GRANT ALL ON public.org_job_counters TO service_role;
ALTER TABLE public.org_job_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ojc select" ON public.org_job_counters FOR SELECT TO authenticated USING (organisation_id = current_org_id());

CREATE TABLE public.garage_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_number int,
  job_year int,
  customer_id uuid NOT NULL REFERENCES public.garage_customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.garage_vehicles(id) ON DELETE RESTRICT,
  mechanic_id uuid REFERENCES public.garage_mechanics(id) ON DELETE SET NULL,
  reported_problem text NOT NULL,
  mileage_at_intake numeric,
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  status text NOT NULL DEFAULT 'received',
  -- received | diagnosing | estimate | awaiting_approval | approved |
  -- in_progress | quality_check | ready | delivered | closed | cancelled
  expected_completion date,
  notes text,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_jobs TO authenticated;
GRANT ALL ON public.garage_jobs TO service_role;
ALTER TABLE public.garage_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_jobs_org_status ON public.garage_jobs(organisation_id, status);
CREATE INDEX idx_garage_jobs_customer ON public.garage_jobs(customer_id);
CREATE INDEX idx_garage_jobs_vehicle ON public.garage_jobs(vehicle_id);
CREATE INDEX idx_garage_jobs_mechanic ON public.garage_jobs(mechanic_id);
CREATE UNIQUE INDEX garage_jobs_org_job_number_idx ON public.garage_jobs(organisation_id, job_year, job_number);

CREATE POLICY "gj select" ON public.garage_jobs FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gj insert" ON public.garage_jobs FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gj update" ON public.garage_jobs FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gj delete" ON public.garage_jobs FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_jobs_updated BEFORE UPDATE ON public.garage_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.assign_job_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int;
  y int := EXTRACT(year FROM now())::int;
BEGIN
  IF NEW.job_number IS NOT NULL THEN RETURN NEW; END IF;
  NEW.job_year := y;
  INSERT INTO public.org_job_counters(organisation_id, year, next_number) VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_job_counters SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.job_number := n;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assign_job_number BEFORE INSERT ON public.garage_jobs
  FOR EACH ROW EXECUTE FUNCTION public.assign_job_number();

-- ===== Status audit trail (section 53 rule 12: "maintain auditability") =====
CREATE TABLE public.garage_job_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.garage_job_status_history TO authenticated;
GRANT ALL ON public.garage_job_status_history TO service_role;
ALTER TABLE public.garage_job_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_job_status_history_job ON public.garage_job_status_history(job_id, created_at);

CREATE OR REPLACE FUNCTION public.garage_job_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.garage_jobs WHERE id = _id AND organisation_id = current_org_id())
$$;

CREATE POLICY "gjsh select" ON public.garage_job_status_history FOR SELECT TO authenticated
  USING (garage_job_in_org(job_id));
CREATE POLICY "gjsh insert" ON public.garage_job_status_history FOR INSERT TO authenticated
  WITH CHECK (garage_job_in_org(job_id) AND can_write(current_org_id()));

CREATE OR REPLACE FUNCTION public.record_garage_job_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.garage_job_status_history (job_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.garage_job_status_history (job_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

    IF NEW.status = 'in_progress' AND OLD.started_at IS NULL THEN NEW.started_at := now(); END IF;
    IF NEW.status = 'ready' THEN NEW.ready_at := now(); END IF;
    IF NEW.status = 'delivered' THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'closed' THEN NEW.closed_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_garage_job_status_change_insert
AFTER INSERT ON public.garage_jobs
FOR EACH ROW EXECUTE FUNCTION public.record_garage_job_status_change();

CREATE TRIGGER trg_record_garage_job_status_change_update
BEFORE UPDATE ON public.garage_jobs
FOR EACH ROW EXECUTE FUNCTION public.record_garage_job_status_change();
