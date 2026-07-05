-- ============================================================
-- Tighten: the anon INSERT policy on checklist_execution_responses
-- only checked that the execution_id row existed
-- (checklist_execution_exists), not that it was actually an
-- anon-eligible fleet pre-start execution. Since execution rows are
-- inserted with status = 'completed' up front by the mobile flow
-- (see PreStartInspection.tsx), we can't gate on status alone —
-- instead require the same fleet/template eligibility check used for
-- the execution insert, plus a freshness window, so a leaked/guessed
-- execution_id from another org or an older/unrelated checklist
-- can't be used to inject responses.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_submit_fleet_inspection_response(_execution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_executions e
    JOIN public.checklist_templates t ON t.id = e.template_id
    WHERE e.id = _execution_id
      AND t.organisation_id = e.organisation_id
      AND t.is_fleet_pre_start = true
      AND t.status = 'approved'
      AND e.created_at > now() - interval '15 minutes'
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_submit_fleet_inspection_response(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "anon can submit pre-start inspection responses" ON public.checklist_execution_responses;
CREATE POLICY "anon can submit pre-start inspection responses"
ON public.checklist_execution_responses FOR INSERT
TO anon
WITH CHECK (public.can_submit_fleet_inspection_response(execution_id));

-- checklist_execution_exists is no longer used by any policy; drop it.
DROP FUNCTION IF EXISTS public.checklist_execution_exists(uuid);
