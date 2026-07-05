-- ============================================================
-- Fix: 20260629000300_industry_profile.sql regressed handle_new_user()
-- by reintroducing an INSERT into profiles.role, a column that was
-- dropped in 20260610180650. This broke all new signups (500 on
-- auth.signUp). Recreate the function without profiles.role, keeping
-- the industry_profile resolution added for the Fleet & Logistics work.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_token      TEXT;
  invite_row        public.org_invites%ROWTYPE;
  new_org_id        UUID;
  org_name          TEXT;
  full_name         TEXT;
  assigned_role     app_role;
  _industry_profile public.industry_profile;
BEGIN
  full_name    := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- Resolve industry_profile from metadata
  _industry_profile := CASE COALESCE(NEW.raw_user_meta_data->>'industry_profile', '')
    WHEN 'fleet_logistics' THEN 'fleet_logistics'::public.industry_profile
    WHEN 'garage'          THEN 'garage'::public.industry_profile
    WHEN 'mixed'           THEN 'mixed'::public.industry_profile
    ELSE                        'manufacturing'::public.industry_profile
  END;

  -- Invite path: join existing org, no new org created
  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_row FROM public.org_invites
      WHERE token      = invite_token
        AND status     = 'pending'
        AND expires_at > now()
        AND lower(email) = lower(NEW.email)
      LIMIT 1;

    IF invite_row.id IS NOT NULL THEN
      assigned_role := invite_row.role;
      INSERT INTO public.profiles (id, organisation_id, full_name)
        VALUES (NEW.id, invite_row.organisation_id, full_name);
      INSERT INTO public.user_roles (user_id, organisation_id, role)
        VALUES (NEW.id, invite_row.organisation_id, assigned_role);
      UPDATE public.org_invites
        SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
        WHERE id = invite_row.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Default path: create a new organisation
  org_name := COALESCE(NEW.raw_user_meta_data->>'organisation_name', 'My Company');
  INSERT INTO public.organisations (name, industry_profile)
    VALUES (org_name, _industry_profile)
    RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organisation_id, full_name)
    VALUES (NEW.id, new_org_id, full_name);
  INSERT INTO public.user_roles (user_id, organisation_id, role)
    VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;
