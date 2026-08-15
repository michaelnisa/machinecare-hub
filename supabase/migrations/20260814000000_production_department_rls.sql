-- Production department access control.
--
-- Lets an org scope the four Production-suite tables (production_kpis,
-- oee_records, quality_reports, utilities_kpis) to whoever is assigned to
-- the Production department. Default behaviour (profiles.department IS
-- NULL, which is every existing user today) is unchanged: unrestricted
-- access, exactly as before. Owners always see everything. Assigning a
-- user's department to anything other than 'production' excludes them
-- from these 4 tables only -- machines, work orders, fleet, etc. are
-- untouched by this migration.

CREATE OR REPLACE FUNCTION public.has_department_access(_department text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), public.current_org_id(), 'owner')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organisation_id = public.current_org_id()
        AND (department IS NULL OR department = _department)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.has_department_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_department_access(text) TO authenticated;

-- production_kpis
DROP POLICY IF EXISTS "pk select" ON public.production_kpis;
DROP POLICY IF EXISTS "pk insert" ON public.production_kpis;
DROP POLICY IF EXISTS "pk update" ON public.production_kpis;
DROP POLICY IF EXISTS "pk delete" ON public.production_kpis;

CREATE POLICY "pk select" ON public.production_kpis FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('production'));
CREATE POLICY "pk insert" ON public.production_kpis FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "pk update" ON public.production_kpis FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "pk delete" ON public.production_kpis FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('production'));

-- oee_records
DROP POLICY IF EXISTS "oee select org" ON public.oee_records;
DROP POLICY IF EXISTS "oee insert writer" ON public.oee_records;
DROP POLICY IF EXISTS "oee update writer" ON public.oee_records;
DROP POLICY IF EXISTS "oee delete manager" ON public.oee_records;

CREATE POLICY "oee select org" ON public.oee_records FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id() AND has_department_access('production'));
CREATE POLICY "oee insert writer" ON public.oee_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "oee update writer" ON public.oee_records FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id) AND has_department_access('production'))
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "oee delete manager" ON public.oee_records FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_manage(organisation_id) AND has_department_access('production'));

-- quality_reports
DROP POLICY IF EXISTS "qr select" ON public.quality_reports;
DROP POLICY IF EXISTS "qr insert" ON public.quality_reports;
DROP POLICY IF EXISTS "qr update" ON public.quality_reports;
DROP POLICY IF EXISTS "qr delete" ON public.quality_reports;

CREATE POLICY "qr select" ON public.quality_reports FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('production'));
CREATE POLICY "qr insert" ON public.quality_reports FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "qr update" ON public.quality_reports FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "qr delete" ON public.quality_reports FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('production'));

-- utilities_kpis
DROP POLICY IF EXISTS "uk select" ON public.utilities_kpis;
DROP POLICY IF EXISTS "uk insert" ON public.utilities_kpis;
DROP POLICY IF EXISTS "uk update" ON public.utilities_kpis;
DROP POLICY IF EXISTS "uk delete" ON public.utilities_kpis;

CREATE POLICY "uk select" ON public.utilities_kpis FOR SELECT TO authenticated
  USING (organisation_id = current_org_id() AND has_department_access('production'));
CREATE POLICY "uk insert" ON public.utilities_kpis FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "uk update" ON public.utilities_kpis FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id) AND has_department_access('production'));
CREATE POLICY "uk delete" ON public.utilities_kpis FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id) AND has_department_access('production'));
