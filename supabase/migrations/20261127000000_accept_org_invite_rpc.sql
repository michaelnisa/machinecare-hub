-- ============================================================================
-- Migration: Accept Org Invite for Existing Users
-- Allows signed-in users with existing accounts to accept an org invite,
-- linking their profile to the organisation and assigning their invited role.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invite public.org_invites%ROWTYPE;
  v_org_name text;
  v_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invite';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 1. Find the invite by token
  SELECT * INTO v_invite FROM public.org_invites
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'This invite link is invalid or has expired';
  END IF;

  -- 2. Verify recipient email matches (case-insensitive)
  IF lower(v_invite.email) <> v_user_email THEN
    RAISE EXCEPTION 'This invite is for %, but you are signed in as %', v_invite.email, v_user_email;
  END IF;

  SELECT name INTO v_org_name FROM public.organisations WHERE id = v_invite.organisation_id;
  v_role := v_invite.role;

  -- 3. Update or create user profile with the organisation & department
  UPDATE public.profiles
  SET organisation_id = v_invite.organisation_id,
      department = COALESCE(v_invite.department, department)
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, organisation_id, department, full_name)
    VALUES (v_user_id, v_invite.organisation_id, v_invite.department, split_part(v_user_email, '@', 1));
  END IF;

  -- 4. Upsert user role for this organisation
  INSERT INTO public.user_roles (user_id, organisation_id, role)
  VALUES (v_user_id, v_invite.organisation_id, v_role)
  ON CONFLICT (user_id, organisation_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- 5. Mark invite as accepted
  UPDATE public.org_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id,
      accepted_by_name = (SELECT full_name FROM public.profiles WHERE id = v_user_id)
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'organisation_id', v_invite.organisation_id,
    'organisation_name', COALESCE(v_org_name, 'the organisation'),
    'role', v_role::text,
    'department', v_invite.department
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_org_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;
