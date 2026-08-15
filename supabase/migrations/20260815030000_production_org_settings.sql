-- Per-org production cost config (for turning downtime/scrap into TZS lost)
-- and alert thresholds (for auto-flagging a bad shift). All nullable —
-- the features stay inactive until an org fills them in via Settings.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS production_cost_per_downtime_minute numeric,
  ADD COLUMN IF NOT EXISTS production_cost_per_scrap_unit numeric,
  ADD COLUMN IF NOT EXISTS production_alert_attainment_threshold numeric,
  ADD COLUMN IF NOT EXISTS production_alert_downtime_minutes numeric;

-- Threshold alerting: fires regardless of whether the log came from the app,
-- an import, or the offline sync queue, since it lives on the table itself
-- rather than in client code.
CREATE OR REPLACE FUNCTION public.check_production_thresholds()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_att_threshold numeric;
  v_downtime_threshold numeric;
  v_machine_name text;
BEGIN
  SELECT production_alert_attainment_threshold, production_alert_downtime_minutes
    INTO v_att_threshold, v_downtime_threshold
    FROM public.organisations WHERE id = NEW.organisation_id;

  IF v_att_threshold IS NULL AND v_downtime_threshold IS NULL THEN
    RETURN NEW;
  END IF;

  IF (v_att_threshold IS NOT NULL AND NEW.target_units > 0 AND NEW.attainment_percent < v_att_threshold)
     OR (v_downtime_threshold IS NOT NULL AND NEW.downtime_minutes > v_downtime_threshold) THEN
    SELECT name INTO v_machine_name FROM public.machines WHERE id = NEW.machine_id;

    INSERT INTO public.maintenance_notifications (
      organisation_id, machine_id, title, description, severity, work_order_id
    ) VALUES (
      NEW.organisation_id,
      NEW.machine_id,
      'Production shortfall — ' || coalesce(v_machine_name, 'unassigned machine') || ' (' || NEW.record_date || coalesce(' ' || NEW.shift, '') || ')',
      'Attainment ' || round(coalesce(NEW.attainment_percent, 0), 1) || '%, downtime ' || NEW.downtime_minutes || ' min.',
      'high',
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_production_thresholds ON public.production_kpis;
CREATE TRIGGER trg_check_production_thresholds
AFTER INSERT OR UPDATE ON public.production_kpis
FOR EACH ROW EXECUTE FUNCTION public.check_production_thresholds();
