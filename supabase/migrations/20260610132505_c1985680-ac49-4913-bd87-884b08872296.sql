-- Vendors register + outsourced work-order tracking

CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  specialties TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id));
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id));
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_manage(organisation_id));

CREATE TRIGGER vendors_touch_updated BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX vendors_org_idx ON public.vendors(organisation_id);

-- Extend work_orders for outsourced jobs
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_outsourced BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_date DATE,
  ADD COLUMN IF NOT EXISTS promised_date DATE,
  ADD COLUMN IF NOT EXISTS returned_date DATE,
  ADD COLUMN IF NOT EXISTS vendor_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vendor_currency TEXT,
  ADD COLUMN IF NOT EXISTS warranty_days INT,
  ADD COLUMN IF NOT EXISTS warranty_notes TEXT,
  ADD COLUMN IF NOT EXISTS had_comeback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comeback_notes TEXT;

CREATE INDEX IF NOT EXISTS work_orders_vendor_idx ON public.work_orders(vendor_id);