
-- Public machine identity RPC (anonymous-safe)
CREATE OR REPLACE FUNCTION public.get_machine_public(_machine_id uuid)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  name text,
  category text,
  make text,
  model text,
  year int,
  registration_number text,
  serial_number text,
  status text,
  cover_image_url text,
  current_hours numeric,
  organisation_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.organisation_id, m.name, m.category, m.make, m.model, m.year,
         m.registration_number, m.serial_number, m.status, m.cover_image_url,
         m.current_hours, o.name
  FROM public.machines m
  JOIN public.organisations o ON o.id = m.organisation_id
  WHERE m.id = _machine_id
$$;

GRANT EXECUTE ON FUNCTION public.get_machine_public(uuid) TO anon, authenticated;

-- Fault reports table (anonymous submissions allowed)
CREATE TABLE public.fault_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  reporter_name text NOT NULL,
  reporter_phone text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fault_reports TO authenticated;
GRANT INSERT ON public.fault_reports TO anon;
GRANT ALL ON public.fault_reports TO service_role;

ALTER TABLE public.fault_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) may submit a fault report, but only if machine exists and org matches
CREATE POLICY "anyone can submit fault report"
ON public.fault_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id AND m.organisation_id = fault_reports.organisation_id)
);

CREATE POLICY "org members can view fault reports"
ON public.fault_reports FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can update fault reports"
ON public.fault_reports FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org managers can delete fault reports"
ON public.fault_reports FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE TRIGGER trg_fault_reports_updated
BEFORE UPDATE ON public.fault_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_fault_reports_machine ON public.fault_reports(machine_id, created_at DESC);
CREATE INDEX idx_fault_reports_org_status ON public.fault_reports(organisation_id, status);
