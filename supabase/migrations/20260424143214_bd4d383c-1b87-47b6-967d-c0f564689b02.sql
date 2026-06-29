-- =========================================================
-- 1. ROLES (separate table, never on profiles)
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'technician', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organisation_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organisation_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organisation_id = _org_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND organisation_id = _org_id
  )
$$;

CREATE POLICY "View roles in own org" ON public.user_roles
FOR SELECT USING (organisation_id = public.current_org_id());

CREATE POLICY "Owners/managers manage roles" ON public.user_roles
FOR ALL USING (
  organisation_id = public.current_org_id()
  AND (public.has_role(auth.uid(), organisation_id, 'owner') OR public.has_role(auth.uid(), organisation_id, 'manager'))
)
WITH CHECK (
  organisation_id = public.current_org_id()
  AND (public.has_role(auth.uid(), organisation_id, 'owner') OR public.has_role(auth.uid(), organisation_id, 'manager'))
);

-- Backfill existing users as owners of their organisation
INSERT INTO public.user_roles (user_id, organisation_id, role)
SELECT id, organisation_id, 'owner'::public.app_role FROM public.profiles
ON CONFLICT DO NOTHING;

-- Update handle_new_user to also assign owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  full_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organisation_name', 'My Company');
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.organisations (name, industry)
  VALUES (org_name, COALESCE(NEW.raw_user_meta_data->>'industry', 'Other'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organisation_id, full_name, role)
  VALUES (NEW.id, new_org_id, full_name, 'owner');

  INSERT INTO public.user_roles (user_id, organisation_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;

-- =========================================================
-- 2. WORK ORDERS
-- =========================================================
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  schedule_id UUID,
  service_log_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  status TEXT NOT NULL DEFAULT 'open',     -- open, in_progress, completed, cancelled
  assignee_id UUID,
  due_date DATE,
  created_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo select" ON public.work_orders FOR SELECT USING (organisation_id = public.current_org_id());
CREATE POLICY "wo insert" ON public.work_orders FOR INSERT WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "wo update" ON public.work_orders FOR UPDATE USING (organisation_id = public.current_org_id());
CREATE POLICY "wo delete" ON public.work_orders FOR DELETE USING (organisation_id = public.current_org_id());

CREATE INDEX idx_wo_org_status ON public.work_orders(organisation_id, status);
CREATE INDEX idx_wo_assignee ON public.work_orders(assignee_id);

-- =========================================================
-- 3. PARTS INVENTORY
-- =========================================================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  name TEXT NOT NULL,
  part_number TEXT,
  category TEXT,                         -- filter, oil, belt, tyre, other
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv select" ON public.inventory_items FOR SELECT USING (organisation_id = public.current_org_id());
CREATE POLICY "inv insert" ON public.inventory_items FOR INSERT WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "inv update" ON public.inventory_items FOR UPDATE USING (organisation_id = public.current_org_id());
CREATE POLICY "inv delete" ON public.inventory_items FOR DELETE USING (organisation_id = public.current_org_id());

-- Link service_parts to inventory (optional)
ALTER TABLE public.service_parts ADD COLUMN inventory_item_id UUID;

-- Auto-deduct stock when service part inserted
CREATE OR REPLACE FUNCTION public.adjust_inventory_on_part()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items SET quantity = quantity - COALESCE(NEW.quantity, 0), updated_at = now()
      WHERE id = NEW.inventory_item_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items SET quantity = quantity + COALESCE(OLD.quantity, 0), updated_at = now()
      WHERE id = OLD.inventory_item_id;
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items SET quantity = quantity + COALESCE(OLD.quantity, 0) WHERE id = OLD.inventory_item_id;
    END IF;
    IF NEW.inventory_item_id IS NOT NULL THEN
      UPDATE public.inventory_items SET quantity = quantity - COALESCE(NEW.quantity, 0), updated_at = now() WHERE id = NEW.inventory_item_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_adjust_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.service_parts
FOR EACH ROW EXECUTE FUNCTION public.adjust_inventory_on_part();

-- =========================================================
-- 4. FUEL & ODOMETER LOGS
-- =========================================================
CREATE TABLE public.fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer NUMERIC,            -- km or hours
  fuel_litres NUMERIC,
  fuel_cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'TZS',
  station TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel select" ON public.fuel_logs FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "fuel insert" ON public.fuel_logs FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "fuel update" ON public.fuel_logs FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "fuel delete" ON public.fuel_logs FOR DELETE USING (public.machine_in_org(machine_id));

CREATE INDEX idx_fuel_machine_date ON public.fuel_logs(machine_id, recorded_at DESC);

-- =========================================================
-- 5. DOCUMENT EXPIRY
-- =========================================================
ALTER TABLE public.documents ADD COLUMN doc_category TEXT;       -- insurance, registration, inspection, manual, other
ALTER TABLE public.documents ADD COLUMN issuer TEXT;
ALTER TABLE public.documents ADD COLUMN issued_on DATE;
ALTER TABLE public.documents ADD COLUMN expires_on DATE;
ALTER TABLE public.documents ADD COLUMN reminder_days INTEGER NOT NULL DEFAULT 30;

CREATE INDEX idx_docs_expiry ON public.documents(machine_id, expires_on);

-- =========================================================
-- 6. updated_at triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_wo_updated BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();