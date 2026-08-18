-- The QR machine page (/m/:id) already lets anyone submit a fault report,
-- but there was no way to report an accident/injury/near-miss from the
-- same public surface — those could only be logged by a signed-in user
-- from the internal Safety module (public.safety_incidents, "si insert"
-- policy is TO authenticated only). Extend safety_incidents the same way
-- fault_reports was opened up: anon-safe columns, a scoped INSERT policy,
-- a rate limit, a photo path, and a notification into the existing
-- maintenance_notifications feed so managers see it immediately.

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS reporter_name text,
  ADD COLUMN IF NOT EXISTS reporter_phone text,
  ADD COLUMN IF NOT EXISTS photo_url text;

GRANT INSERT ON public.safety_incidents TO anon;

-- Reuses machine_belongs_to_org() (added in 20260920000000_fix_fault_report_rls.sql)
-- so the check runs SECURITY DEFINER and isn't blocked by RLS on machines.
CREATE POLICY "anyone can report an accident"
ON public.safety_incidents FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.machine_belongs_to_org(machine_id, organisation_id)
  AND incident_type IN ('accident', 'injury', 'near_miss', 'property_damage', 'environmental')
);

-- Anon photo upload, mirroring "Anon upload fault report photos"
CREATE POLICY "Anon upload accident report photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[2] = 'incidents'
    AND EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = ((storage.foldername(name))[3])::uuid
        AND m.organisation_id = ((storage.foldername(name))[1])::uuid
    )
  );

CREATE OR REPLACE FUNCTION public.rl_safety_incidents()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.reported_by IS NULL THEN
    PERFORM public.enforce_rate_limit('safety_incident:' || NEW.machine_id::text, 8, 15);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rl_safety_incidents ON public.safety_incidents;
CREATE TRIGGER trg_rl_safety_incidents
BEFORE INSERT ON public.safety_incidents
FOR EACH ROW EXECUTE FUNCTION public.rl_safety_incidents();

CREATE OR REPLACE FUNCTION public.notify_new_safety_incident()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_machine_name text;
BEGIN
  -- Only for public/anon submissions — incidents logged directly in the
  -- Safety module by a signed-in user already surface there.
  IF NEW.reported_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_machine_name FROM public.machines WHERE id = NEW.machine_id;

  INSERT INTO public.maintenance_notifications (organisation_id, machine_id, title, description, severity, reported_by)
  VALUES (
    NEW.organisation_id,
    NEW.machine_id,
    initcap(replace(NEW.incident_type, '_', ' ')) || ' reported — ' || COALESCE(v_machine_name, 'Machine'),
    NEW.description || COALESCE(' (reported by ' || NEW.reporter_name || ', ' || NEW.reporter_phone || ')', ''),
    CASE WHEN NEW.incident_type IN ('accident', 'injury') OR NEW.severity IN ('high', 'critical') THEN 'high' ELSE 'medium' END,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_safety_incident ON public.safety_incidents;
CREATE TRIGGER trg_notify_new_safety_incident
AFTER INSERT ON public.safety_incidents
FOR EACH ROW EXECUTE FUNCTION public.notify_new_safety_incident();
