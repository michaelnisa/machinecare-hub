-- ============================================================
-- 1. Add 'engineer' to the app_role enum
--    PostgreSQL enums are altered with ADD VALUE; it is
--    idempotent when prefixed with IF NOT EXISTS (PG 9.6+).
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'engineer';

-- ============================================================
-- 2. Update can_write() so engineers can log services,
--    complete work orders, upload documents, etc.
--    (Engineers author & approve checklists and manage
--    maintenance plans — they need write access.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_write(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), _org_id, 'owner')
      OR has_role(auth.uid(), _org_id, 'manager')
      OR has_role(auth.uid(), _org_id, 'engineer')
      OR has_role(auth.uid(), _org_id, 'technician')
$$;

-- ============================================================
-- 3. Atomic role assignment RPC
--    Replaces the unsafe delete-then-insert pattern in Team.tsx.
--    Runs inside a single transaction: if the INSERT fails the
--    DELETE is rolled back automatically — the user never ends
--    up with no role.
--
--    Security: caller must be owner or manager in that org.
--    The function is SECURITY DEFINER so it can bypass RLS,
--    but the permission check is enforced first.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_role(
  _user_id      UUID,
  _org_id       UUID,
  _role         public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owners or managers may reassign roles
  IF NOT public.can_manage(_org_id) THEN
    RAISE EXCEPTION 'permission denied: only owners and managers can change roles';
  END IF;

  -- Prevent removing the last owner of an organisation
  IF _role <> 'owner' THEN
    IF (
      SELECT COUNT(*) FROM public.user_roles
      WHERE organisation_id = _org_id
        AND role = 'owner'
        AND user_id <> _user_id
    ) = 0 THEN
      RAISE EXCEPTION 'cannot demote the only owner of this organisation';
    END IF;
  END IF;

  -- Atomic swap: delete all current roles for this user in this org,
  -- then insert the new one. Both happen in the same transaction.
  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND organisation_id = _org_id;

  INSERT INTO public.user_roles (user_id, organisation_id, role)
  VALUES (_user_id, _org_id, _role);
END;
$$;

-- Restrict to authenticated users only (SECURITY DEFINER functions
-- are callable by public by default, which is a security risk).
REVOKE EXECUTE ON FUNCTION public.set_user_role(UUID, UUID, public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_user_role(UUID, UUID, public.app_role) TO authenticated;
