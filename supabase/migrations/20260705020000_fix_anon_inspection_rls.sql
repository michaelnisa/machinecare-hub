-- ============================================================
-- Fix: the anon INSERT policies added for the pre-start inspection
-- flow used inline EXISTS(...) subqueries against machines,
-- checklist_templates and checklist_executions. Those tables' own
-- RLS SELECT policies require current_org_id() (an authenticated
-- session), so as the anon role the subqueries always saw zero rows
-- and the WITH CHECK always evaluated false — every anonymous
-- inspection submission was rejected with 42501, regardless of
-- whether the data was actually valid.
--
-- Fix: move the checks into SECURITY DEFINER helper functions (the
-- same pattern already used by machine_in_org / can_write / etc.),
-- which bypass the caller's RLS visibility when evaluating the check.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_submit_fleet_inspection(_org_id uuid, _machine_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.checklist_templates t ON t.id = _template_id
    WHERE m.id = _machine_id
      AND m.organisation_id = _org_id
      AND t.organisation_id = _org_id
      AND t.is_fleet_pre_start = true
      AND t.status = 'approved'
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_submit_fleet_inspection(uuid, uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.checklist_execution_exists(_execution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.checklist_executions WHERE id = _execution_id)
$$;

GRANT EXECUTE ON FUNCTION public.checklist_execution_exists(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "anon can submit pre-start inspection" ON public.checklist_executions;
CREATE POLICY "anon can submit pre-start inspection"
ON public.checklist_executions FOR INSERT
TO anon
WITH CHECK (public.can_submit_fleet_inspection(organisation_id, machine_id, template_id));

DROP POLICY IF EXISTS "anon can submit pre-start inspection responses" ON public.checklist_execution_responses;
CREATE POLICY "anon can submit pre-start inspection responses"
ON public.checklist_execution_responses FOR INSERT
TO anon
WITH CHECK (public.checklist_execution_exists(execution_id));
