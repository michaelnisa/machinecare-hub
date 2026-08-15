-- Two fixes to the Permit to Work flow:
--
-- 1. Technicians couldn't create work orders at all ("wo insert" required
--    can_manage, i.e. owner/manager only), so the "Request Permit to Work
--    from Safety" checkbox on WorkOrderNew.tsx was unreachable for the
--    people actually doing the work. Relax creation to can_write (owner/
--    manager/engineer/technician), matching who can already log service
--    work and update work orders.
--
-- 2. The Safety review team was too loosely defined: has_department_access()
--    treats "department IS NULL" as full access, so *any* user without a
--    department assigned could approve/reject a permit, not just Safety.
--    The review team should be exactly: owner, manager (supervisor), and
--    users in the Safety department. New can_review_safety() replaces
--    has_department_access('safety') on wo_safety_approvals specifically —
--    has_department_access() itself is left untouched since other tables
--    (production_kpis, oee_records, ...) intentionally rely on its
--    "no department set = unrestricted" default for existing users.

DROP POLICY IF EXISTS "wo insert" ON public.work_orders;
CREATE POLICY "wo insert" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

CREATE OR REPLACE FUNCTION public.can_review_safety(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.can_manage(_org)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND organisation_id = _org AND department = 'safety'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_safety(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_safety(uuid) TO authenticated;

DROP POLICY IF EXISTS "wsa select" ON public.wo_safety_approvals;
DROP POLICY IF EXISTS "wsa update" ON public.wo_safety_approvals;
DROP POLICY IF EXISTS "wsa delete" ON public.wo_safety_approvals;

CREATE POLICY "wsa select" ON public.wo_safety_approvals FOR SELECT TO authenticated
  USING (
    organisation_id = current_org_id()
    AND (can_review_safety(organisation_id) OR requested_by = auth.uid())
  );
CREATE POLICY "wsa update" ON public.wo_safety_approvals FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "wsa delete" ON public.wo_safety_approvals FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
