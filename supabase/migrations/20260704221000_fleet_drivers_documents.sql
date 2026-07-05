-- ============================================================
-- PHASE 2: Fleet & Logistics — Drivers + Vehicle Documents
-- ============================================================

-- 1. Fleet-specific fields on machines (nullable — only used by fleet orgs)
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS plate_number text,
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS tank_capacity_l numeric,
  ADD COLUMN IF NOT EXISTS current_odometer_km numeric,
  ADD COLUMN IF NOT EXISTS home_depot text;

-- 2. Drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  licence_number text,
  licence_class text,
  licence_expiry date,
  medical_expiry date,
  photo_url text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view drivers"
ON public.drivers FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert drivers"
ON public.drivers FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update drivers"
ON public.drivers FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org managers can delete drivers"
ON public.drivers FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE TRIGGER trg_drivers_updated
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_drivers_org ON public.drivers(organisation_id);
CREATE INDEX idx_drivers_org_licence_expiry ON public.drivers(organisation_id, licence_expiry);
CREATE INDEX idx_drivers_org_medical_expiry ON public.drivers(organisation_id, medical_expiry);

-- 3. Vehicle documents
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('insurance', 'road_licence', 'inspection', 'fitness', 'permit', 'other')),
  number text,
  issued_on date,
  expires_on date,
  file_url text,
  reminder_days int NOT NULL DEFAULT 30,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view vehicle documents"
ON public.vehicle_documents FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

CREATE POLICY "org writers can insert vehicle documents"
ON public.vehicle_documents FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org writers can update vehicle documents"
ON public.vehicle_documents FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

CREATE POLICY "org managers can delete vehicle documents"
ON public.vehicle_documents FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE TRIGGER trg_vehicle_documents_updated
BEFORE UPDATE ON public.vehicle_documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_vehicle_documents_machine ON public.vehicle_documents(machine_id);
CREATE INDEX idx_vehicle_documents_org_expiry ON public.vehicle_documents(organisation_id, expires_on);
