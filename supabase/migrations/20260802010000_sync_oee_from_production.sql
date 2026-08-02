-- ============================================================
-- Production KPIs -> OEE sync
-- Production logs and OEE records were entered completely
-- independently, so the same machine/day could carry two
-- disagreeing downtime/output numbers. Production logs now
-- optionally carry the two extra inputs OEE needs (planned
-- minutes, ideal cycle time); whenever they're present, a
-- trigger aggregates that machine/day's production logs into
-- the matching oee_records row automatically.
-- ============================================================

ALTER TABLE public.production_kpis
  ADD COLUMN IF NOT EXISTS planned_minutes numeric,
  ADD COLUMN IF NOT EXISTS ideal_cycle_seconds numeric;

-- Distinguishes OEE rows computed from production logs from ones entered
-- directly on the OEE page (e.g. for machines not yet logged via Production).
ALTER TABLE public.oee_records
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE OR REPLACE FUNCTION public.recompute_oee_for_day(_org uuid, _machine uuid, _date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_planned numeric;
  v_downtime numeric;
  v_units numeric;
  v_good numeric;
  v_cycle numeric;
BEGIN
  IF _machine IS NULL OR _date IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    SUM(planned_minutes),
    SUM(downtime_minutes),
    SUM(actual_units),
    SUM(GREATEST(actual_units - scrap_units, 0)),
    CASE WHEN SUM(actual_units) > 0
      THEN SUM(actual_units * COALESCE(ideal_cycle_seconds, 0)) / SUM(actual_units)
      ELSE 0 END
  INTO v_count, v_planned, v_downtime, v_units, v_good, v_cycle
  FROM public.production_kpis
  WHERE machine_id = _machine
    AND record_date = _date
    AND planned_minutes IS NOT NULL
    AND planned_minutes > 0;

  IF v_count IS NULL OR v_count = 0 THEN
    -- No production logs with OEE inputs left for this machine/day —
    -- remove the auto-synced record but never touch a manually entered one.
    DELETE FROM public.oee_records
    WHERE machine_id = _machine AND record_date = _date AND source = 'production_sync';
    RETURN;
  END IF;

  INSERT INTO public.oee_records (
    organisation_id, machine_id, record_date, planned_minutes, downtime_minutes,
    units_produced, units_good, ideal_cycle_seconds, source
  )
  VALUES (_org, _machine, _date, v_planned, v_downtime, v_units, v_good, v_cycle, 'production_sync')
  ON CONFLICT (machine_id, record_date) DO UPDATE SET
    planned_minutes = EXCLUDED.planned_minutes,
    downtime_minutes = EXCLUDED.downtime_minutes,
    units_produced = EXCLUDED.units_produced,
    units_good = EXCLUDED.units_good,
    ideal_cycle_seconds = EXCLUDED.ideal_cycle_seconds,
    source = 'production_sync',
    updated_at = now()
  WHERE public.oee_records.source = 'production_sync';
END $$;

CREATE OR REPLACE FUNCTION public.trg_production_kpis_sync_oee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_oee_for_day(OLD.organisation_id, OLD.machine_id, OLD.record_date);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_oee_for_day(NEW.organisation_id, NEW.machine_id, NEW.record_date);

  IF TG_OP = 'UPDATE' AND (OLD.machine_id IS DISTINCT FROM NEW.machine_id OR OLD.record_date IS DISTINCT FROM NEW.record_date) THEN
    PERFORM public.recompute_oee_for_day(OLD.organisation_id, OLD.machine_id, OLD.record_date);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_production_kpis_sync_oee ON public.production_kpis;
CREATE TRIGGER trg_production_kpis_sync_oee
AFTER INSERT OR UPDATE OR DELETE ON public.production_kpis
FOR EACH ROW EXECUTE FUNCTION public.trg_production_kpis_sync_oee();
