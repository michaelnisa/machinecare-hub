
-- 1) Induction-assets storage policies: enforce org folder prefix
DROP POLICY IF EXISTS "induction assets read" ON storage.objects;
DROP POLICY IF EXISTS "induction assets insert" ON storage.objects;
DROP POLICY IF EXISTS "induction assets update" ON storage.objects;
DROP POLICY IF EXISTS "induction assets delete" ON storage.objects;

CREATE POLICY "induction assets read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'induction-assets' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "induction assets insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'induction-assets' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "induction assets update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'induction-assets' AND (storage.foldername(name))[1] = public.current_org_id()::text)
  WITH CHECK (bucket_id = 'induction-assets' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "induction assets delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'induction-assets' AND (storage.foldername(name))[1] = public.current_org_id()::text);

-- 2) Remove role from profiles (handle_new_user references it; recreate without it)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invite_token TEXT;
  invite_row public.org_invites%ROWTYPE;
  new_org_id UUID;
  org_name TEXT;
  full_name TEXT;
  assigned_role app_role;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_row FROM public.org_invites
      WHERE token = invite_token AND status = 'pending' AND expires_at > now()
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

  org_name := COALESCE(NEW.raw_user_meta_data->>'organisation_name', 'My Company');
  INSERT INTO public.organisations (name, industry)
  VALUES (org_name, COALESCE(NEW.raw_user_meta_data->>'industry', 'Other'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organisation_id, full_name)
  VALUES (NEW.id, new_org_id, full_name);
  INSERT INTO public.user_roles (user_id, organisation_id, role)
  VALUES (NEW.id, new_org_id, 'owner');
  RETURN NEW;
END;
$function$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 3) org_wo_counters: explicit service-role write policy
DROP POLICY IF EXISTS "org_wo_counters service writes" ON public.org_wo_counters;
CREATE POLICY "org_wo_counters service writes" ON public.org_wo_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) Realtime: require org-prefixed topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org-scoped realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Org-scoped realtime write" ON realtime.messages;

CREATE POLICY "Org-scoped realtime read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.current_org_id() IS NOT NULL
    AND realtime.topic() LIKE public.current_org_id()::text || ':%'
  );

CREATE POLICY "Org-scoped realtime write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_org_id() IS NOT NULL
    AND realtime.topic() LIKE public.current_org_id()::text || ':%'
  );

-- 5) Fix mutable search_path on email helper functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$function$;

-- 6) Revoke EXECUTE from anon on email queue helpers (only edge functions/service should call these)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 7) Revoke EXECUTE from anon on internal helper SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.transition_wo(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_author_templates(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.machine_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.module_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.programme_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_in_org(uuid) FROM anon;
