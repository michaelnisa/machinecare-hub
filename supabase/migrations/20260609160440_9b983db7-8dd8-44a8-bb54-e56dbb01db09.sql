
-- 1. machine_checklist_items: restrict to authenticated
DROP POLICY IF EXISTS "ci select" ON public.machine_checklist_items;
CREATE POLICY "ci select" ON public.machine_checklist_items
  FOR SELECT TO authenticated
  USING (public.machine_in_org(machine_id));

-- 2. user_roles: restrict to authenticated
DROP POLICY IF EXISTS "View roles in own org" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/managers manage roles" ON public.user_roles;

CREATE POLICY "View roles in own org" ON public.user_roles
  FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

CREATE POLICY "Owners/managers manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.can_manage(organisation_id))
  WITH CHECK (public.can_manage(organisation_id));

-- 3. Storage policies for machine-docs: enforce org_id prefix
DROP POLICY IF EXISTS "Auth read machine-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload machine-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth update machine-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete machine-docs" ON storage.objects;

CREATE POLICY "Org read machine-docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "Org upload machine-docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "Org update machine-docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "Org delete machine-docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
