-- ============================================================
-- Safety Department QR Gateway, Safety Team, Toolbox Talks & Work Suspensions
-- ============================================================

-- 1. Org-Level Safety Department Gateway Settings
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS safety_qr_slug TEXT DEFAULT 'safety-gate',
  ADD COLUMN IF NOT EXISTS safety_emergency_phone TEXT,
  ADD COLUMN IF NOT EXISTS safety_first_aid_phone TEXT;

-- 2. Add department & safety_role to org_invites
ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS safety_role TEXT DEFAULT 'officer'; -- 'manager', 'officer', 'auditor', 'first_aid'

-- 3. Add safety_role to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS safety_role TEXT DEFAULT 'officer';

-- Ensure handle_new_user trigger populates department and safety_role from invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_token      TEXT;
  invite_row        public.org_invites%ROWTYPE;
  new_org_id        UUID;
  org_name          TEXT;
  full_name         TEXT;
  assigned_role     app_role;
  _industry_profile public.industry_profile;
  _department       TEXT;
  _safety_role      TEXT;
BEGIN
  full_name    := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- Resolve industry_profile from metadata
  _industry_profile := CASE COALESCE(NEW.raw_user_meta_data->>'industry_profile', '')
    WHEN 'fleet_logistics' THEN 'fleet_logistics'::public.industry_profile
    WHEN 'garage'          THEN 'garage'::public.industry_profile
    WHEN 'mixed'           THEN 'mixed'::public.industry_profile
    ELSE                        'manufacturing'::public.industry_profile
  END;

  -- Invite path: join existing org, no new org created
  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_row FROM public.org_invites
      WHERE token      = invite_token
        AND status     = 'pending'
        AND expires_at > now()
        AND lower(email) = lower(NEW.email)
      LIMIT 1;

    IF invite_row.id IS NOT NULL THEN
      assigned_role := invite_row.role;
      _department   := invite_row.department;
      _safety_role  := COALESCE(invite_row.safety_role, 'officer');

      INSERT INTO public.profiles (id, organisation_id, full_name, role, department, safety_role)
        VALUES (NEW.id, invite_row.organisation_id, full_name, assigned_role::text, _department, _safety_role);

      INSERT INTO public.user_roles (user_id, organisation_id, role)
        VALUES (NEW.id, invite_row.organisation_id, assigned_role);

      UPDATE public.org_invites
        SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
        WHERE id = invite_row.id;

      RETURN NEW;
    END IF;
  END IF;

  -- Default path: create a new organisation
  org_name := COALESCE(NEW.raw_user_meta_data->>'organisation_name', 'My Company');
  INSERT INTO public.organisations (name, industry_profile)
    VALUES (org_name, _industry_profile)
    RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organisation_id, full_name, role)
    VALUES (NEW.id, new_org_id, full_name, 'owner');
  INSERT INTO public.user_roles (user_id, organisation_id, role)
    VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;

-- 4. Contractor Toolbox Talks Table
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

-- 5. Contractor Work Suspensions Table (Stop Work Authority)
CREATE TABLE IF NOT EXISTS public.contractor_work_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  suspended_by_type VARCHAR(32) NOT NULL DEFAULT 'contractor', -- 'contractor' | 'safety_supervisor'
  suspended_by_name VARCHAR(128) NOT NULL,
  suspension_reason TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'unsafe_condition', -- 'unsafe_condition', 'missing_permit', 'gas_alarm', 'loto_failure', 'weather', 'equipment_defect', 'other'
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at TIMESTAMPTZ,
  resumed_by_name VARCHAR(128),
  corrective_action_taken TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'suspended' -- 'suspended' | 'resumed'
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

-- 6. Add Work Order Suspension Tracking Columns
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 7. Allow anonymous inspection of safety gateway settings
DROP POLICY IF EXISTS "org anon gateway select" ON public.organisations;
CREATE POLICY "org anon gateway select" ON public.organisations
  FOR SELECT TO anon
  USING (true);
