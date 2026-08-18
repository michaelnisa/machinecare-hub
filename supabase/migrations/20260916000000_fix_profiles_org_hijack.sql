-- CRITICAL: the "profiles update self" policy (20260502133827) has no
-- WITH CHECK clause, so Postgres reuses its USING qual (id = auth.uid())
-- as the check on the NEW row too — meaning nothing stops a user from
-- updating their OWN profile's organisation_id to a DIFFERENT org's id.
-- Since current_org_id() (used by virtually every RLS policy in the app)
-- is derived from profiles.organisation_id, this let any authenticated
-- user grant themselves read access to any other tenant's data simply by
-- knowing that tenant's organisation_id — trivially obtainable since
-- get_machine_public() returns it in plaintext to anon on every QR scan.
--
-- Fix: explicitly pin organisation_id (and role-adjacent identity columns)
-- to their current stored value on every self-update, so only genuinely
-- self-editable fields (full_name, phone, avatar, language, etc.) can
-- actually change.
DROP POLICY IF EXISTS "profiles update self" ON public.profiles;
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organisation_id = current_org_id());
