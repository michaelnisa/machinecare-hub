-- ============================================================
-- Safety Champion Leaderboard, Chemical Storage & Drum QR (HazCom/GHS), and 5-Whys RCA
-- ============================================================

-- 1. Chemical Storage & Drum QR Registry (HazCom / OSHA 1910.1200 / GHS)
CREATE TABLE IF NOT EXISTS public.safety_chemicals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  cas_number VARCHAR(64),
  un_number VARCHAR(32),
  storage_location VARCHAR(255) NOT NULL,
  container_type VARCHAR(64) DEFAULT 'drum',
  signal_word VARCHAR(16) DEFAULT 'Warning', -- 'Danger', 'Warning', 'None'
  ghs_pictograms JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["flammable", "corrosive", "toxic"]
  hazard_statements TEXT,
  precautionary_statements TEXT,
  first_aid_inhalation TEXT,
  first_aid_skin TEXT,
  first_aid_eyes TEXT,
  first_aid_ingestion TEXT,
  spill_response_procedure TEXT,
  fire_fighting_measures TEXT,
  required_ppe JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["respirator", "nitrile_gloves", "splash_goggles"]
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
GRANT SELECT ON public.safety_chemicals TO anon; -- Public emergency access upon scanning QR code on drum
GRANT ALL ON public.safety_chemicals TO service_role;

ALTER TABLE public.safety_chemicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chemicals select auth" ON public.safety_chemicals
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY "chemicals insert auth" ON public.safety_chemicals
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY "chemicals update auth" ON public.safety_chemicals
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id());

CREATE POLICY "chemicals delete auth" ON public.safety_chemicals
  FOR DELETE TO authenticated
  USING (organisation_id = current_org_id());

CREATE POLICY "chemicals anon select emergency" ON public.safety_chemicals
  FOR SELECT TO anon
  USING (true);


-- 2. Incident 5-Whys Root Cause Analysis (ISO 45001 §10.2)
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
  root_cause_category VARCHAR(64) NOT NULL DEFAULT 'method', -- 'machine', 'method', 'material', 'human', 'environment'
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

CREATE POLICY "5whys select auth" ON public.safety_5_whys
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY "5whys insert auth" ON public.safety_5_whys
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY "5whys update auth" ON public.safety_5_whys
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id());

CREATE POLICY "5whys delete auth" ON public.safety_5_whys
  FOR DELETE TO authenticated
  USING (organisation_id = current_org_id());
