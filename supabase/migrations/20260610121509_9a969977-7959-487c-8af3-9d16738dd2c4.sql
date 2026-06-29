
-- Revoke from PUBLIC (which includes anon) on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.machine_in_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_in_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_in_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.programme_in_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_in_org(uuid) FROM PUBLIC, anon;

-- Grant only to authenticated (these are used inside RLS policies)
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.machine_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.programme_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_in_org(uuid) TO authenticated;

-- Trigger-only functions: revoke from everyone (triggers run as table owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_first_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_induction_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_on_part() FROM PUBLIC, anon, authenticated;
