-- Fault report improvements: severity (drives WO priority + notification
-- severity instead of a hardcoded 'high'), a photo attachment, a reason
-- captured on dismiss (audit trail), and a duplicate_of link so piled-up
-- reports of the same issue can be merged instead of triaged one by one.

ALTER TABLE public.fault_reports
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'major'
    CHECK (severity IN ('minor', 'major', 'critical')),
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS dismiss_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.fault_reports(id) ON DELETE SET NULL;

-- Anonymous QR submitters can already INSERT a fault_reports row for a
-- machine that exists in the claimed org (existing policy). Extend the
-- same trust boundary to storage: anon may upload a photo, but only under
-- {organisation_id}/faults/{machine_id}/..., and only if that machine
-- really belongs to that org — mirrors the fault_reports INSERT check.
CREATE POLICY "Anon upload fault report photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[2] = 'faults'
    AND EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = ((storage.foldername(name))[3])::uuid
        AND m.organisation_id = ((storage.foldername(name))[1])::uuid
    )
  );

-- Map the report's own severity into the notification instead of always 'high'.
CREATE OR REPLACE FUNCTION public.notify_new_fault_report()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_machine_name text;
  v_notif_severity text;
BEGIN
  SELECT name INTO v_machine_name FROM public.machines WHERE id = NEW.machine_id;

  v_notif_severity := CASE NEW.severity
    WHEN 'critical' THEN 'critical'
    WHEN 'major' THEN 'high'
    ELSE 'medium'
  END;

  INSERT INTO public.maintenance_notifications (organisation_id, machine_id, title, description, severity, reported_by)
  VALUES (
    NEW.organisation_id,
    NEW.machine_id,
    'Fault reported — ' || COALESCE(v_machine_name, 'Machine'),
    NEW.description || ' (reported by ' || NEW.reporter_name || ', ' || NEW.reporter_phone || ')',
    v_notif_severity,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;
