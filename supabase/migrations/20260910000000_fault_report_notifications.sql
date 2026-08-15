-- Fault reports (submitted via QR scan, anonymous or signed-in) previously
-- sat silently in the table until someone happened to open the Fault
-- Reports page — nobody was actually alerted. This surfaces every new
-- report into the same maintenance_notifications feed already used for
-- low-stock/out-of-stock alerts (20260829000000_inventory_phase8_reorder_automation.sql),
-- so it shows up on the Notifications page immediately.

CREATE OR REPLACE FUNCTION public.notify_new_fault_report()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_machine_name text;
BEGIN
  SELECT name INTO v_machine_name FROM public.machines WHERE id = NEW.machine_id;

  INSERT INTO public.maintenance_notifications (organisation_id, machine_id, title, description, severity, reported_by)
  VALUES (
    NEW.organisation_id,
    NEW.machine_id,
    'Fault reported — ' || COALESCE(v_machine_name, 'Machine'),
    NEW.description || ' (reported by ' || NEW.reporter_name || ', ' || NEW.reporter_phone || ')',
    'high',
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_fault_report ON public.fault_reports;
CREATE TRIGGER trg_notify_new_fault_report
AFTER INSERT ON public.fault_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_new_fault_report();
