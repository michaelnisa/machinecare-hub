-- Bug: "new row violates row-level security policy for table fault_reports"
-- The INSERT policy's WITH CHECK ran `EXISTS (SELECT 1 FROM public.machines ...)`
-- directly. That subquery is subject to RLS on public.machines, whose only
-- SELECT policy is scoped to `authenticated` users within their own org.
-- So anonymous QR submitters (and authenticated users viewing another org's
-- machine via the public /m/:id page) could never satisfy the EXISTS check,
-- and every fault report submission was rejected.
--
-- Fix: check machine/org membership through a SECURITY DEFINER function
-- (bypasses RLS on machines), mirroring how get_machine_public already
-- exposes machine identity to anon safely.

CREATE OR REPLACE FUNCTION public.machine_belongs_to_org(_machine_id uuid, _organisation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.machines m
    WHERE m.id = _machine_id
      AND m.organisation_id = _organisation_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.machine_belongs_to_org(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.machine_belongs_to_org(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "anyone can submit fault report" ON public.fault_reports;
CREATE POLICY "anyone can submit fault report"
ON public.fault_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.machine_belongs_to_org(machine_id, organisation_id)
);
