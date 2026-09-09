-- ==============================================================================
-- MACHINECARE HUB - COMPLETE REPAIR MIGRATION
-- Fixes missing tables:
--   1. public.safety_chemicals
--   2. public.safety_5_whys
--   3. public.contractor_work_suspensions
--   4. public.contractor_toolbox_talks
-- Fixes missing columns:
--   - public.work_orders (is_suspended, suspension_reason)
--   - public.profiles (role, department, safety_role, phone)
--   - public.org_invites (department, safety_role)
--   - public.organisations (safety_qr_slug, safety_emergency_phone, safety_first_aid_phone)
-- Reloads PostgREST schema cache.
-- ==============================================================================

-- 1. PROFILES COLUMNS (Fixes "Column profile.role does not exist", etc.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'technician',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS safety_role TEXT DEFAULT 'officer',
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. ORG_INVITES COLUMNS (Fixes "Column org_invite.department does not exist")
ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS safety_role TEXT DEFAULT 'officer';

-- 3. WORK_ORDERS SUSPENSION COLUMNS (Fixes "column work_orders.is_suspended does not exist")
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 4. ORGANISATIONS GATEWAY COLUMNS
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS safety_qr_slug TEXT DEFAULT 'safety-gate',
  ADD COLUMN IF NOT EXISTS safety_emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS safety_first_aid_phone TEXT;

-- 5. CONTRACTOR WORK SUSPENSIONS TABLE (Stop Work Authority)
CREATE TABLE IF NOT EXISTS public.contractor_work_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  suspended_by_type VARCHAR(32) NOT NULL DEFAULT 'contractor',
  suspended_by_name VARCHAR(128) NOT NULL,
  suspension_reason TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'unsafe_condition',
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at TIMESTAMPTZ,
  resumed_by_name VARCHAR(128),
  corrective_action_taken TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'suspended'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_work_suspensions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contractor_work_suspensions TO anon;
GRANT ALL ON public.contractor_work_suspensions TO service_role;

ALTER TABLE public.contractor_work_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cws select auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws select auth" ON public.contractor_work_suspensions
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "cws insert auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws insert auth" ON public.contractor_work_suspensions
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "cws update auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws update auth" ON public.contractor_work_suspensions
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "cws anon select" ON public.contractor_work_suspensions;
CREATE POLICY "cws anon select" ON public.contractor_work_suspensions
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "cws anon insert" ON public.contractor_work_suspensions;
CREATE POLICY "cws anon insert" ON public.contractor_work_suspensions
  FOR INSERT TO anon
  WITH CHECK (true);

-- 6. CONTRACTOR TOOLBOX TALKS TABLE
CREATE TABLE IF NOT EXISTS public.contractor_toolbox_talks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  talk_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic VARCHAR(255) NOT NULL,
  supervisor_name VARCHAR(128) NOT NULL,
  location VARCHAR(255),
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  attendee_count INT NOT NULL DEFAULT 0,
  man_hours NUMERIC(6,2) DEFAULT 0,
  hazards_discussed TEXT,
  controls_agreed TEXT,
  supervisor_signature TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_toolbox_talks TO authenticated;
GRANT SELECT, INSERT ON public.contractor_toolbox_talks TO anon;
GRANT ALL ON public.contractor_toolbox_talks TO service_role;

ALTER TABLE public.contractor_toolbox_talks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ctt select auth" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt select auth" ON public.contractor_toolbox_talks
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "ctt insert auth" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt insert auth" ON public.contractor_toolbox_talks
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "ctt update auth" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt update auth" ON public.contractor_toolbox_talks
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "ctt anon select" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt anon select" ON public.contractor_toolbox_talks
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "ctt anon insert" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt anon insert" ON public.contractor_toolbox_talks
  FOR INSERT TO anon
  WITH CHECK (true);

-- 7. CHEMICAL STORAGE & DRUM QR (Fixes "Could not find the table public.safety_chemicals in the schema cache")
CREATE TABLE IF NOT EXISTS public.safety_chemicals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  cas_number VARCHAR(64),
  un_number VARCHAR(32),
  storage_location VARCHAR(255) NOT NULL,
  container_type VARCHAR(64) DEFAULT 'drum',
  signal_word VARCHAR(16) DEFAULT 'Warning',
  ghs_pictograms JSONB NOT NULL DEFAULT '[]'::jsonb,
  hazard_statements TEXT,
  precautionary_statements TEXT,
  first_aid_inhalation TEXT,
  first_aid_skin TEXT,
  first_aid_eyes TEXT,
  first_aid_ingestion TEXT,
  spill_response_procedure TEXT,
  fire_fighting_measures TEXT,
  required_ppe JSONB NOT NULL DEFAULT '[]'::jsonb,
  sds_document_url TEXT,
  emergency_phone VARCHAR(64),
  max_storage_quantity NUMERIC(10,2),
  current_quantity NUMERIC(10,2) DEFAULT 0,
  unit VARCHAR(32) DEFAULT 'Liters',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_chemicals TO authenticated;
GRANT SELECT ON public.safety_chemicals TO anon;
GRANT ALL ON public.safety_chemicals TO service_role;

ALTER TABLE public.safety_chemicals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chemicals select auth" ON public.safety_chemicals;
CREATE POLICY "chemicals select auth" ON public.safety_chemicals
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "chemicals insert auth" ON public.safety_chemicals;
CREATE POLICY "chemicals insert auth" ON public.safety_chemicals
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "chemicals update auth" ON public.safety_chemicals;
CREATE POLICY "chemicals update auth" ON public.safety_chemicals
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "chemicals delete auth" ON public.safety_chemicals;
CREATE POLICY "chemicals delete auth" ON public.safety_chemicals
  FOR DELETE TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "chemicals anon select emergency" ON public.safety_chemicals;
CREATE POLICY "chemicals anon select emergency" ON public.safety_chemicals
  FOR SELECT TO anon
  USING (true);

-- 8. 5-WHYS ROOT CAUSE ANALYSIS TABLE (ISO 45001 §10.2)
CREATE TABLE IF NOT EXISTS public.safety_5_whys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.safety_incidents(id) ON DELETE CASCADE,
  problem_statement TEXT NOT NULL,
  why_1 TEXT NOT NULL,
  why_2 TEXT,
  why_3 TEXT,
  why_4 TEXT,
  why_5 TEXT,
  root_cause_summary TEXT NOT NULL,
  root_cause_category VARCHAR(64) NOT NULL DEFAULT 'method',
  preventive_measures TEXT,
  capa_id UUID REFERENCES public.corrective_actions(id) ON DELETE SET NULL,
  investigated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  investigator_name VARCHAR(128),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_incident_5_whys UNIQUE (incident_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_5_whys TO authenticated;
GRANT ALL ON public.safety_5_whys TO service_role;

ALTER TABLE public.safety_5_whys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "5whys select auth" ON public.safety_5_whys;
CREATE POLICY "5whys select auth" ON public.safety_5_whys
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "5whys insert auth" ON public.safety_5_whys;
CREATE POLICY "5whys insert auth" ON public.safety_5_whys
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

DROP POLICY IF EXISTS "5whys update auth" ON public.safety_5_whys;
CREATE POLICY "5whys update auth" ON public.safety_5_whys
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "5whys delete auth" ON public.safety_5_whys;
CREATE POLICY "5whys delete auth" ON public.safety_5_whys
  FOR DELETE TO authenticated
  USING (organisation_id = current_org_id());

-- 9. RELOAD SCHEMA CACHE IN POSTGREST
NOTIFY pgrst, 'reload schema';
