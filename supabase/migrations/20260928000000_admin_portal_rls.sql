-- Admin Portal RLS & Overview RPC
-- Grants michaelnisa3@gmail.com cross-organisation read access for platform monitoring

-- 1. Update organisations SELECT policy for admin
DROP POLICY IF EXISTS "Platform admin select organisations" ON public.organisations;
CREATE POLICY "Platform admin select organisations" ON public.organisations 
FOR SELECT TO authenticated 
USING (
  id = current_org_id() 
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'michaelnisa3@gmail.com'
);

-- 2. Update profiles SELECT policy for admin
DROP POLICY IF EXISTS "Platform admin select profiles" ON public.profiles;
CREATE POLICY "Platform admin select profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  organisation_id = current_org_id()
  OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'michaelnisa3@gmail.com'
);

-- 3. Security definer RPC function for platform admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _calling_email text;
  _orgs jsonb;
  _profiles jsonb;
  _requests jsonb;
BEGIN
  SELECT email INTO _calling_email FROM auth.users WHERE id = auth.uid();
  
  IF _calling_email IS NULL OR LOWER(_calling_email) <> 'michaelnisa3@gmail.com' THEN
    RAISE EXCEPTION 'Access denied. Admin authorization required.';
  END IF;

  SELECT jsonb_agg(to_jsonb(o)) INTO _orgs
  FROM (
    SELECT id, name, industry_profile, plan, created_at
    FROM public.organisations
    ORDER BY created_at DESC
  ) o;

  SELECT jsonb_agg(to_jsonb(p)) INTO _profiles
  FROM (
    SELECT id, organisation_id, full_name, email, created_at
    FROM public.profiles
    ORDER BY created_at DESC
  ) p;

  SELECT jsonb_agg(to_jsonb(r)) INTO _requests
  FROM (
    SELECT id, name, contact, company, industry, status, created_at
    FROM public.onboarding_requests
    ORDER BY created_at DESC
  ) r;

  RETURN jsonb_build_object(
    'organisations', COALESCE(_orgs, '[]'::jsonb),
    'profiles', COALESCE(_profiles, '[]'::jsonb),
    'requests', COALESCE(_requests, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_platform_overview() TO authenticated;
