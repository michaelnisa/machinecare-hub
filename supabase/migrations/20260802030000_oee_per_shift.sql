-- ============================================================
-- Per-shift OEE
-- oee_records was capped at one row per machine per day
-- (UNIQUE machine_id, record_date), so a plant running Day/Evening/
-- Night shifts could only ever see one blended OEE number for the
-- whole day — despite the app's own marketing copy promising OEE
-- "per machine, line and shift". Adds a shift dimension (defaulting
-- to 'All' for orgs/records that don't track shifts) and extends
-- the production-log sync (see 20260802010000) to aggregate per
-- shift instead of per day.
-- ============================================================

ALTER TABLE public.oee_records
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'All';

ALTER TABLE public.oee_records DROP CONSTRAINT IF EXISTS oee_records_machine_id_record_date_key;
ALTER TABLE public.oee_records ADD CONSTRAINT oee_records_machine_id_record_date_shift_key
  UNIQUE (machine_id, record_date, shift);

CREATE OR REPLACE FUNCTION public.recompute_oee_for_shift(_org uuid, _machine uuid, _date date, _shift text)
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
  IF _machine IS NULL OR _date IS NULL OR _shift IS NULL THEN RETURN; END IF;

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
    AND COALESCE(shift, 'All') = _shift
    AND planned_minutes IS NOT NULL
    AND planned_minutes > 0;

  IF v_count IS NULL OR v_count = 0 THEN
    DELETE FROM public.oee_records
    WHERE machine_id = _machine AND record_date = _date AND shift = _shift AND source = 'production_sync';
    RETURN;
  END IF;

  INSERT INTO public.oee_records (
    organisation_id, machine_id, record_date, shift, planned_minutes, downtime_minutes,
    units_produced, units_good, ideal_cycle_seconds, source
  )
  VALUES (_org, _machine, _date, _shift, v_planned, v_downtime, v_units, v_good, v_cycle, 'production_sync')
  ON CONFLICT (machine_id, record_date, shift) DO UPDATE SET
    planned_minutes = EXCLUDED.planned_minutes,
    downtime_minutes = EXCLUDED.downtime_minutes,
    units_produced = EXCLUDED.units_produced,
    units_good = EXCLUDED.units_good,
    ideal_cycle_seconds = EXCLUDED.ideal_cycle_seconds,
    source = 'production_sync',
    updated_at = now()
  WHERE public.oee_records.source = 'production_sync';
END $$;

-- Superseded by the per-shift version above.
DROP FUNCTION IF EXISTS public.recompute_oee_for_day(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.trg_production_kpis_sync_oee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_oee_for_shift(OLD.organisation_id, OLD.machine_id, OLD.record_date, COALESCE(OLD.shift, 'All'));
    RETURN OLD;
  END IF;

  PERFORM public.recompute_oee_for_shift(NEW.organisation_id, NEW.machine_id, NEW.record_date, COALESCE(NEW.shift, 'All'));

  IF TG_OP = 'UPDATE' AND (
    OLD.machine_id IS DISTINCT FROM NEW.machine_id
    OR OLD.record_date IS DISTINCT FROM NEW.record_date
    OR COALESCE(OLD.shift, 'All') IS DISTINCT FROM COALESCE(NEW.shift, 'All')
  ) THEN
    PERFORM public.recompute_oee_for_shift(OLD.organisation_id, OLD.machine_id, OLD.record_date, COALESCE(OLD.shift, 'All'));
  END IF;

  RETURN NEW;
END $$;
