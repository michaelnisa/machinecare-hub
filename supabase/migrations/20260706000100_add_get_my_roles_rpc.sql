-- ============================================================
-- CLAUDE.md convention: "Never check roles by querying user_roles
-- directly from the client. Always check roles via the has_role()
-- security-definer function." src/hooks/useUserRole.ts was doing a
-- direct client-side select against user_roles. RLS happened to
-- make that safe, but it's inconsistent with the stated model and
-- silently stops being safe if that policy is ever loosened.
--
-- Add a SECURITY DEFINER RPC that returns the caller's own roles in
-- their own organisation, so the client never touches user_roles
-- directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
    AND organisation_id = public.current_org_id()
$$;

GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;
