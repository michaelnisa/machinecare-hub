-- Organisations
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's org id (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Machines
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INT,
  serial_number TEXT,
  registration_number TEXT,
  purchase_date DATE,
  current_hours NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.machines(organisation_id);

-- Service schedules
CREATE TABLE public.service_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'small',
  interval_days INT,
  interval_hours NUMERIC,
  last_service_date DATE,
  last_service_hours NUMERIC,
  next_due_date DATE,
  next_due_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_schedules ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.service_schedules(machine_id);

-- Service logs
CREATE TABLE public.service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.service_schedules(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  performed_by TEXT,
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  hours_at_service NUMERIC,
  cost NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'TZS',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.service_logs(machine_id);

-- Service parts
CREATE TABLE public.service_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_log_id UUID NOT NULL REFERENCES public.service_logs(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_number TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  part_type TEXT DEFAULT 'original',
  supplier TEXT,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT
);
ALTER TABLE public.service_parts ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.service_parts(service_log_id);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  service_log_id UUID REFERENCES public.service_logs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.documents(machine_id);

-- Knowledge items
CREATE TABLE public.knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'procedure',
  content TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.knowledge_items(machine_id);

-- ===== RLS POLICIES =====
-- Organisations: members can view, owners can update
CREATE POLICY "Members can view own org" ON public.organisations FOR SELECT
  USING (id = public.current_org_id());
CREATE POLICY "Members can update own org" ON public.organisations FOR UPDATE
  USING (id = public.current_org_id());

-- Profiles: members can view profiles in their org; users update their own
CREATE POLICY "View profiles in own org" ON public.profiles FOR SELECT
  USING (organisation_id = public.current_org_id());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Machines
CREATE POLICY "Org members select machines" ON public.machines FOR SELECT
  USING (organisation_id = public.current_org_id());
CREATE POLICY "Org members insert machines" ON public.machines FOR INSERT
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "Org members update machines" ON public.machines FOR UPDATE
  USING (organisation_id = public.current_org_id());
CREATE POLICY "Org members delete machines" ON public.machines FOR DELETE
  USING (organisation_id = public.current_org_id());

-- Helper function: machine belongs to current user's org
CREATE OR REPLACE FUNCTION public.machine_in_org(_machine_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.machines WHERE id = _machine_id AND organisation_id = public.current_org_id())
$$;

-- Service schedules
CREATE POLICY "ss select" ON public.service_schedules FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "ss insert" ON public.service_schedules FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "ss update" ON public.service_schedules FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "ss delete" ON public.service_schedules FOR DELETE USING (public.machine_in_org(machine_id));

-- Service logs
CREATE POLICY "sl select" ON public.service_logs FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "sl insert" ON public.service_logs FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "sl update" ON public.service_logs FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "sl delete" ON public.service_logs FOR DELETE USING (public.machine_in_org(machine_id));

-- Helper function: service log belongs to current user's org
CREATE OR REPLACE FUNCTION public.log_in_org(_log_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_logs sl
    JOIN public.machines m ON m.id = sl.machine_id
    WHERE sl.id = _log_id AND m.organisation_id = public.current_org_id()
  )
$$;

-- Service parts
CREATE POLICY "sp select" ON public.service_parts FOR SELECT USING (public.log_in_org(service_log_id));
CREATE POLICY "sp insert" ON public.service_parts FOR INSERT WITH CHECK (public.log_in_org(service_log_id));
CREATE POLICY "sp update" ON public.service_parts FOR UPDATE USING (public.log_in_org(service_log_id));
CREATE POLICY "sp delete" ON public.service_parts FOR DELETE USING (public.log_in_org(service_log_id));

-- Documents
CREATE POLICY "doc select" ON public.documents FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "doc insert" ON public.documents FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "doc update" ON public.documents FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "doc delete" ON public.documents FOR DELETE USING (public.machine_in_org(machine_id));

-- Knowledge items
CREATE POLICY "ki select" ON public.knowledge_items FOR SELECT USING (public.machine_in_org(machine_id));
CREATE POLICY "ki insert" ON public.knowledge_items FOR INSERT WITH CHECK (public.machine_in_org(machine_id));
CREATE POLICY "ki update" ON public.knowledge_items FOR UPDATE USING (public.machine_in_org(machine_id));
CREATE POLICY "ki delete" ON public.knowledge_items FOR DELETE USING (public.machine_in_org(machine_id));

-- ===== Auto-create org and profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Storage bucket =====
INSERT INTO storage.buckets (id, name, public) VALUES ('machine-docs', 'machine-docs', true);

CREATE POLICY "Public read machine-docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'machine-docs');
CREATE POLICY "Auth upload machine-docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine-docs');
CREATE POLICY "Auth update own machine-docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'machine-docs' AND owner = auth.uid());
CREATE POLICY "Auth delete own machine-docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'machine-docs' AND owner = auth.uid());