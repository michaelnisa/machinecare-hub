-- ============================================================
-- Fix: Repair handle_new_user() trigger and onboarding request notification
-- ============================================================
-- 1. In migration 20261004000000, handle_new_user() regressed by attempting
--    to INSERT into profiles.role and profiles.safety_role. Neither column exists on
--    profiles (roles are stored in user_roles table). This broke all new signups.
--    This migration fixes handle_new_user to correctly insert only into valid
--    profiles columns and user_roles.
-- 2. Wrap handle_new_onboarding_request in an EXCEPTION block so email queue
--    failures never abort the request insertion.
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
  _plan             TEXT;
  _modules          TEXT[];
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

      -- Insert into profiles without non-existent role or safety_role columns
      INSERT INTO public.profiles (id, organisation_id, full_name, department)
        VALUES (NEW.id, invite_row.organisation_id, full_name, invite_row.department);

      -- Assign role via user_roles table
      INSERT INTO public.user_roles (user_id, organisation_id, role)
        VALUES (NEW.id, invite_row.organisation_id, assigned_role)
        ON CONFLICT (user_id, organisation_id) DO NOTHING;

      UPDATE public.org_invites
        SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
        WHERE id = invite_row.id;

      RETURN NEW;
    END IF;
  END IF;

  -- Default path: create a new organisation
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'organisation_name',
    'My Company'
  );
  _plan    := COALESCE(NEW.raw_user_meta_data->>'plan', 'standard');

  -- Extract modules array if provided in metadata
  IF NEW.raw_user_meta_data->'enabled_modules' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'enabled_modules') = 'array' THEN
    SELECT COALESCE(array_agg(x), ARRAY['maintenance']::text[])
      INTO _modules
      FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'enabled_modules') t(x);
  ELSE
    _modules := ARRAY['maintenance', 'inventory', 'work_orders'];
  END IF;

  INSERT INTO public.organisations (name, industry_profile, plan, enabled_modules)
    VALUES (org_name, _industry_profile, _plan, _modules)
    RETURNING id INTO new_org_id;

  -- Insert profile for the user (columns: id, organisation_id, full_name)
  INSERT INTO public.profiles (id, organisation_id, full_name)
    VALUES (NEW.id, new_org_id, full_name);

  -- Assign 'owner' role in user_roles table
  INSERT INTO public.user_roles (user_id, organisation_id, role)
    VALUES (NEW.id, new_org_id, 'owner')
    ON CONFLICT (user_id, organisation_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Make handle_new_onboarding_request safe against email queue errors
CREATE OR REPLACE FUNCTION public.handle_new_onboarding_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE
  _message_id text;
  _resolved_subject text;
  _html text;
  _text text;
  _from text;
  _sender_domain text;
BEGIN
  BEGIN
    _message_id := gen_random_uuid()::text;
    _resolved_subject := 'New Onboarding Request: ' || COALESCE(NEW.company, 'Company');
    _from := 'rigwell-pro <noreply@notify.machinecare.co.tz>';
    _sender_domain := 'notify.machinecare.co.tz';

    _html := '<h2>New Onboarding Request Received</h2>' ||
             '<p><strong>Name:</strong> ' || COALESCE(NEW.name, 'N/A') || '</p>' ||
             '<p><strong>Contact:</strong> ' || COALESCE(NEW.contact, 'N/A') || '</p>' ||
             '<p><strong>Company:</strong> ' || COALESCE(NEW.company, 'N/A') || '</p>' ||
             '<p><strong>Industry:</strong> ' || COALESCE(NEW.industry, 'N/A') || '</p>' ||
             '<p><strong>Submitted At:</strong> ' || COALESCE(NEW.created_at::text, 'N/A') || '</p>';

    _text := 'New Onboarding Request Received' || E'\n\n' ||
             'Name: ' || COALESCE(NEW.name, 'N/A') || E'\n' ||
             'Contact: ' || COALESCE(NEW.contact, 'N/A') || E'\n' ||
             'Company: ' || COALESCE(NEW.company, 'N/A') || E'\n' ||
             'Industry: ' || COALESCE(NEW.industry, 'N/A') || E'\n' ||
             'Submitted At: ' || COALESCE(NEW.created_at::text, 'N/A');

    -- Insert into email_send_log
    INSERT INTO public.email_send_log (
      message_id,
      template_name,
      recipient_email,
      status
    ) VALUES (
      _message_id,
      'onboarding-request-notification',
      'michaelnisa3@gmail.com',
      'pending'
    );

    -- Enqueue the email via pgmq
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'message_id', _message_id,
        'to', 'michaelnisa3@gmail.com',
        'from', _from,
        'sender_domain', _sender_domain,
        'subject', _resolved_subject,
        'html', _html,
        'text', _text,
        'purpose', 'transactional',
        'label', 'onboarding-request-notification',
        'queued_at', now()::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: warning only, do not abort insertion
    RAISE WARNING 'handle_new_onboarding_request notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
