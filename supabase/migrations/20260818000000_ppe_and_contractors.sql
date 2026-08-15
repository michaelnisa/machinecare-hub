-- Safety module: PPE Management (integrated with Inventory) and Contractor
-- Management (integrated with the existing Induction system). Follows the
-- same org-scoped RLS pattern as 20260817000000_safety_module_expansion.sql.

-- ===== PPE =====
-- Requirements: what PPE is mandatory for a given activity, set by Safety.
CREATE TABLE public.ppe_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  activity text NOT NULL,
  required_ppe text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppe_requirements TO authenticated;
GRANT ALL ON public.ppe_requirements TO service_role;
ALTER TABLE public.ppe_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr select" ON public.ppe_requirements FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "pr insert" ON public.ppe_requirements FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "pr update" ON public.ppe_requirements FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "pr delete" ON public.ppe_requirements FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Issues: PPE handed to an employee or a contractor worker. Optionally linked
-- to an inventory_items row so stock can be deducted on issue (mirrors how
-- service_parts already deduct inventory_items.quantity from app code).
CREATE TABLE public.ppe_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contractor_worker_id uuid, -- FK added after contractor_workers exists below
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ppe_type text NOT NULL,
  size text,
  quantity int NOT NULL DEFAULT 1,
  condition text NOT NULL DEFAULT 'new', -- new | good | fair | worn | damaged
  status text NOT NULL DEFAULT 'issued', -- issued | returned | replaced | expired
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expiry_date date,
  replacement_date date,
  returned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ppe_issues_holder_chk CHECK (employee_id IS NOT NULL OR contractor_worker_id IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppe_issues TO authenticated;
GRANT ALL ON public.ppe_issues TO service_role;
ALTER TABLE public.ppe_issues ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ppe_issues_employee ON public.ppe_issues(employee_id);
CREATE INDEX idx_ppe_issues_expiry ON public.ppe_issues(organisation_id, expiry_date);

CREATE POLICY "pi select" ON public.ppe_issues FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "pi insert" ON public.ppe_issues FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pi update" ON public.ppe_issues FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pi delete" ON public.ppe_issues FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Contractor Management =====
CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  insurance_expiry date,
  insurance_doc_url text,
  status text NOT NULL DEFAULT 'active', -- active | suspended
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ctr select" ON public.contractors FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ctr insert" ON public.contractors FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ctr update" ON public.contractors FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ctr delete" ON public.contractors FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE OR REPLACE FUNCTION public.contractor_in_org(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contractors WHERE id = _id AND organisation_id = current_org_id())
$$;

-- Individual workers belonging to a contractor company. inductee_id links to
-- the existing induction system (inductees/induction_records) so a worker's
-- induction/expiry status can be checked without duplicating that data.
CREATE TABLE public.contractor_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  id_number text,
  role_title text,
  phone text,
  inductee_id uuid REFERENCES public.inductees(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_workers TO authenticated;
GRANT ALL ON public.contractor_workers TO service_role;
ALTER TABLE public.contractor_workers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contractor_workers_contractor ON public.contractor_workers(contractor_id);

CREATE POLICY "cw select" ON public.contractor_workers FOR SELECT TO authenticated
  USING (contractor_in_org(contractor_id));
CREATE POLICY "cw insert" ON public.contractor_workers FOR INSERT TO authenticated
  WITH CHECK (contractor_in_org(contractor_id) AND can_write(current_org_id()));
CREATE POLICY "cw update" ON public.contractor_workers FOR UPDATE TO authenticated
  USING (contractor_in_org(contractor_id) AND can_write(current_org_id()));
CREATE POLICY "cw delete" ON public.contractor_workers FOR DELETE TO authenticated
  USING (contractor_in_org(contractor_id) AND can_write(current_org_id()));

-- Now that contractor_workers exists, wire up the PPE issues FK.
ALTER TABLE public.ppe_issues
  ADD CONSTRAINT ppe_issues_contractor_worker_id_fkey
  FOREIGN KEY (contractor_worker_id) REFERENCES public.contractor_workers(id) ON DELETE SET NULL;

-- Contractor documents: insurance, certificates, licences (mirrors vehicle_documents).
CREATE TABLE public.contractor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'other', -- insurance | certificate | licence | other
  name text NOT NULL,
  file_url text,
  issued_on date,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_documents TO authenticated;
GRANT ALL ON public.contractor_documents TO service_role;
ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contractor_documents_contractor ON public.contractor_documents(contractor_id, expires_on);

CREATE POLICY "cd select" ON public.contractor_documents FOR SELECT TO authenticated
  USING (contractor_in_org(contractor_id));
CREATE POLICY "cd insert" ON public.contractor_documents FOR INSERT TO authenticated
  WITH CHECK (contractor_in_org(contractor_id) AND can_write(current_org_id()));
CREATE POLICY "cd update" ON public.contractor_documents FOR UPDATE TO authenticated
  USING (contractor_in_org(contractor_id) AND can_write(current_org_id()));
CREATE POLICY "cd delete" ON public.contractor_documents FOR DELETE TO authenticated
  USING (contractor_in_org(contractor_id) AND can_write(current_org_id()));

-- Link a work order to the contractor performing it, so permit/PTW history
-- can be traced per contractor via work_orders.contractor_id.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_contractor ON public.work_orders(contractor_id);
