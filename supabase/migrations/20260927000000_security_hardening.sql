-- ============================================================
-- SECURITY HARDENING — fixes all Supabase Security Advisor
-- warnings as of 23 Aug 2026
-- ============================================================
-- Every change here is non-destructive and idempotent: safe to
-- run on a live database without downtime.
-- ============================================================

-- ============================================================
-- 1.  touch_updated_at() — "Function Search Path Mutable"
-- ============================================================
-- The original definition (migration 20260424143214) omitted
-- SECURITY DEFINER and SET search_path.  The Supabase Security
-- Advisor flags this because a PostgreSQL user who can CREATE a
-- SCHEMA could inject a custom now() (or any other built-in name)
-- into a schema that precedes pg_catalog in the search_path,
-- causing the trigger to call their version instead.
-- Fix: add SECURITY DEFINER + pin search_path = public.
-- The function is still REVOKED from all caller roles — triggers
-- fire as the table owner regardless of EXECUTE privilege.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Belt-and-suspenders: keep REVOKE so the function can never be
-- called directly, only via trigger.
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2.  rate_limit_log — RLS disabled on public schema table
-- ============================================================
-- The Supabase Security Advisor requires every table in the
-- public schema to have RLS enabled.  rate_limit_log was
-- intentionally left without RLS (it is only accessed through
-- the enforce_rate_limit() SECURITY DEFINER function, which
-- runs as the postgres/owner role and therefore has BYPASSRLS).
-- Enabling RLS now is safe: SECURITY DEFINER functions continue
-- to work unaffected, and any accidental direct client-side
-- query against this table is blocked for every non-owner role.

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only the service role needs direct read access (for admin
-- diagnostics and manual cleanup — all writes go through the
-- SECURITY DEFINER enforce_rate_limit() trigger helper).
DO $$ BEGIN
  CREATE POLICY "rate_limit_log_service_role"
    ON public.rate_limit_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3.  Trigger-only functions — belt-and-suspenders revoke
-- ============================================================
-- These functions are fired by triggers only (no caller should
-- ever EXECUTE them directly).  Most were already revoked in
-- migration 20260610121509 but re-revoking is fully idempotent
-- and protects against any future CREATE OR REPLACE that would
-- restore default PUBLIC execute access.

REVOKE EXECUTE ON FUNCTION public.touch_updated_at()
  FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.set_induction_expiry()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.adjust_inventory_on_part()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.sync_inventory_item_quantity()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.assign_job_number()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.record_garage_job_status_change()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.rl_fault_reports()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.rl_checklist_executions()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.rl_safety_incidents()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.notify_new_safety_incident()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.check_production_thresholds()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================================
-- 4.  set_user_role — tighten caller set (belt-and-suspenders)
-- ============================================================
-- Added in 20260629000000.  The REVOKE/GRANT pair was already
-- correct there, but repeat here for defence-in-depth.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, uuid, public.app_role)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.set_user_role(uuid, uuid, public.app_role)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================================
-- 5.  Core SECURITY DEFINER helpers — pin search_path sweep
-- ============================================================
-- Supabase flags any SECURITY DEFINER function without an
-- explicit SET search_path.  All core helpers were fixed in
-- 20260502133842 / 20260610121509.  Re-declare only the
-- smallest subset that might have been re-created without the
-- clause (e.g. by copy-paste in a hotfix migration).
-- current_org_id is the most critical; the rest are defensive.

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.machine_in_org(_machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.machines
    WHERE id = _machine_id
      AND organisation_id = public.current_org_id()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.machine_in_org(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.machine_in_org(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), _org_id, 'owner')
      OR public.has_role(auth.uid(), _org_id, 'manager');
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_manage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_write(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), _org_id, 'owner')
      OR public.has_role(auth.uid(), _org_id, 'manager')
      OR public.has_role(auth.uid(), _org_id, 'engineer')
      OR public.has_role(auth.uid(), _org_id, 'technician');
$$;

REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;

-- ============================================================
-- 6.  Ensure log_in_org has search_path (early migration gap)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_in_org(_log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_logs sl
    JOIN public.machines m ON m.id = sl.machine_id
    WHERE sl.id = _log_id
      AND m.organisation_id = public.current_org_id()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.log_in_org(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_in_org(uuid) TO authenticated;
