-- ============================================================
-- Cleanup: a chain of debug_*.sql migrations from RLS
-- troubleshooting (2026-07-05 02:10-02:55) left two problems live:
--
-- 1. SECURITY HOLE: 20260705022000_debug_test_policy.sql dropped the
--    secure anon INSERT policy on checklist_executions (added by
--    20260705020000_fix_anon_inspection_rls.sql, which checks
--    can_submit_fleet_inspection(...)) and replaced it with
--    `WITH CHECK (true)` — allowing any anonymous caller to insert
--    checklist_executions rows for any organisation. Restore the
--    secure policy here.
-- 2. Debug-only functions/RPCs/table exposed to anon/authenticated
--    that have no product purpose and should not ship: schema
--    introspection helpers (debug_list_policies, debug_row_security,
--    debug_grants, debug_current_role, debug_role_attrs), raw-insert
--    test RPCs that write junk rows into fault_reports and
--    checklist_executions (debug_raw_insert_test, debug_raw_insert_test2),
--    and a dummy scratch table (debug_anon_test).
-- ============================================================

-- 1. Restore the secure anon INSERT policy on checklist_executions
DROP POLICY IF EXISTS "anon can submit pre-start inspection" ON public.checklist_executions;
CREATE POLICY "anon can submit pre-start inspection"
ON public.checklist_executions FOR INSERT
TO anon
WITH CHECK (public.can_submit_fleet_inspection(organisation_id, machine_id, template_id));

-- 2. Drop debug introspection/test functions
DROP FUNCTION IF EXISTS public.debug_list_policies(text);
DROP FUNCTION IF EXISTS public.debug_row_security(text);
DROP FUNCTION IF EXISTS public.debug_grants(text);
DROP FUNCTION IF EXISTS public.debug_current_role();
DROP FUNCTION IF EXISTS public.debug_raw_insert_test();
DROP FUNCTION IF EXISTS public.debug_raw_insert_test2();
DROP FUNCTION IF EXISTS public.debug_role_attrs();

-- 3. Drop debug scratch table (and its junk rows/policies with it)
DROP TABLE IF EXISTS public.debug_anon_test;

-- 4. Remove the junk rows the raw-insert debug RPCs wrote into real tables
DELETE FROM public.fault_reports WHERE reporter_name = 'RPC Test';
DELETE FROM public.checklist_execution_responses WHERE execution_id IN (
  SELECT id FROM public.checklist_executions WHERE performed_by_name = 'RPC Test'
);
DELETE FROM public.checklist_executions WHERE performed_by_name = 'RPC Test';
