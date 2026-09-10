-- Migration: Production Security Hardening & Multi-Tenant RLS Tightening
-- Date: 2026-10-07

-- 1. Eliminate Secret Leak on organisations Table
-- Drop the overly permissive policy that allowed anonymous users to SELECT * from organisations
DROP POLICY IF EXISTS "org anon gateway select" ON public.organisations;

-- 2. Provide a Scoped, Secure Public RPC for Safety Gateway & RAMS Pages
-- Exposes ONLY safe public branding and emergency contact details; never exposes api_keys, secrets, or financial config
CREATE OR REPLACE FUNCTION public.get_safety_gateway_org_public(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  safety_emergency_phone text,
  safety_first_aid_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT o.id, o.name, o.logo_url, o.safety_emergency_phone, o.safety_first_aid_phone
    FROM public.organisations o
    WHERE o.id = p_org_id
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT o.id, o.name, o.logo_url, o.safety_emergency_phone, o.safety_first_aid_phone
    FROM public.organisations o
    ORDER BY o.created_at ASC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_safety_gateway_org_public(uuid) TO anon, authenticated, service_role;

-- 3. Eliminate Anonymous Trip Expense Leakage
DROP POLICY IF EXISTS "anon can view trip expenses" ON public.trip_expenses;

-- 4. Tighten Safety Chemicals Table RLS
-- Remove "OR current_org_id() IS NULL" which allowed cross-tenant access when org context was missing
DROP POLICY IF EXISTS "chemicals insert auth" ON public.safety_chemicals;
CREATE POLICY "chemicals insert auth" ON public.safety_chemicals
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "chemicals update auth" ON public.safety_chemicals;
CREATE POLICY "chemicals update auth" ON public.safety_chemicals
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));

-- 5. Tighten Contractor Work Suspensions Table RLS
DROP POLICY IF EXISTS "cws select auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws select auth" ON public.contractor_work_suspensions
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "cws insert auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws insert auth" ON public.contractor_work_suspensions
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "cws update auth" ON public.contractor_work_suspensions;
CREATE POLICY "cws update auth" ON public.contractor_work_suspensions
  FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));

-- Restrict anon work suspension insert: require that the referenced work order exists and belongs to the organisation
DROP POLICY IF EXISTS "cws anon select" ON public.contractor_work_suspensions;
DROP POLICY IF EXISTS "cws anon insert" ON public.contractor_work_suspensions;
CREATE POLICY "cws anon insert" ON public.contractor_work_suspensions
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.organisation_id = organisation_id
    )
  );

-- 6. Tighten Contractor Toolbox Talks Table RLS
DROP POLICY IF EXISTS "ctt select auth" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt select auth" ON public.contractor_toolbox_talks
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "ctt insert auth" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt insert auth" ON public.contractor_toolbox_talks
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

DROP POLICY IF EXISTS "ctt anon select" ON public.contractor_toolbox_talks;
DROP POLICY IF EXISTS "ctt anon insert" ON public.contractor_toolbox_talks;
CREATE POLICY "ctt anon insert" ON public.contractor_toolbox_talks
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractors c
      WHERE c.id = contractor_id AND c.organisation_id = organisation_id
    )
  );

-- 7. Tighten Safety Chemicals SELECT & Delete RLS
DROP POLICY IF EXISTS "chemicals select auth" ON public.safety_chemicals;
CREATE POLICY "chemicals select auth" ON public.safety_chemicals
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

-- 8. Tighten Safety 5-Whys Table RLS
DROP POLICY IF EXISTS "5whys select auth" ON public.safety_5_whys;
CREATE POLICY "5whys select auth" ON public.safety_5_whys
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "5whys insert auth" ON public.safety_5_whys;
CREATE POLICY "5whys insert auth" ON public.safety_5_whys
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

-- 9. Protect Onboarding Requests Table from Cross-Tenant Exposure
DROP POLICY IF EXISTS "Allow authenticated view of onboarding_requests" ON public.onboarding_requests;
CREATE POLICY "Allow platform admin view of onboarding_requests" 
  ON public.onboarding_requests 
  FOR SELECT 
  TO authenticated 
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'michaelnisa3@gmail.com');

DROP POLICY IF EXISTS "Allow authenticated update of onboarding_requests" ON public.onboarding_requests;
CREATE POLICY "Allow platform admin update of onboarding_requests" 
  ON public.onboarding_requests 
  FOR UPDATE 
  TO authenticated 
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'michaelnisa3@gmail.com');

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

