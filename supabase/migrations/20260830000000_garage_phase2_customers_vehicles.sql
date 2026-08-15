-- Workshop/Garage branch Phase 2 (per garage_workshop.md sections 8/9/47):
-- Customers and Vehicles — the two foundational Workshop entities. These
-- are new tables, not a reuse of `machines` (unlike Fleet): a garage
-- vehicle belongs to an external customer, not the organisation itself,
-- and has no PM schedule / checklist / work-order machinery attached to it.

CREATE TABLE public.garage_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_customers TO authenticated;
GRANT ALL ON public.garage_customers TO service_role;
ALTER TABLE public.garage_customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_customers_org ON public.garage_customers(organisation_id);

CREATE POLICY "gc select" ON public.garage_customers FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gc insert" ON public.garage_customers FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gc update" ON public.garage_customers FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gc delete" ON public.garage_customers FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_customers_updated BEFORE UPDATE ON public.garage_customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.garage_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.garage_customers(id) ON DELETE RESTRICT,
  registration_number text,
  vin text,
  make text,
  model text,
  year int,
  engine text,
  fuel_type text,
  transmission text,
  mileage numeric NOT NULL DEFAULT 0,
  photo_url text,
  notes text,
  status text NOT NULL DEFAULT 'active', -- active | inactive
  next_service_date date,
  next_service_mileage numeric,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_vehicles TO authenticated;
GRANT ALL ON public.garage_vehicles TO service_role;
ALTER TABLE public.garage_vehicles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_vehicles_org ON public.garage_vehicles(organisation_id);
CREATE INDEX idx_garage_vehicles_customer ON public.garage_vehicles(customer_id);
CREATE INDEX idx_garage_vehicles_registration ON public.garage_vehicles(organisation_id, registration_number);

CREATE POLICY "gv select" ON public.garage_vehicles FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gv insert" ON public.garage_vehicles FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gv update" ON public.garage_vehicles FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gv delete" ON public.garage_vehicles FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_vehicles_updated BEFORE UPDATE ON public.garage_vehicles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
