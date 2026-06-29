
-- Meter readings (hours / km)
CREATE TABLE public.meter_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  reading NUMERIC NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meter_readings_machine_idx ON public.meter_readings(machine_id, reading_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meter_readings TO authenticated;
GRANT ALL ON public.meter_readings TO service_role;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr select" ON public.meter_readings FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "mr insert" ON public.meter_readings FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "mr update" ON public.meter_readings FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "mr delete" ON public.meter_readings FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(current_org_id()));

-- Machine status history
CREATE TABLE public.machine_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX msh_machine_idx ON public.machine_status_history(machine_id, changed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_status_history TO authenticated;
GRANT ALL ON public.machine_status_history TO service_role;
ALTER TABLE public.machine_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msh select" ON public.machine_status_history FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "msh insert" ON public.machine_status_history FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "msh delete" ON public.machine_status_history FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(current_org_id()));

-- Trigger: when a meter reading is inserted, update machines.current_hours if newer
CREATE OR REPLACE FUNCTION public.apply_meter_reading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.machines
  SET current_hours = NEW.reading
  WHERE id = NEW.machine_id
    AND (current_hours IS NULL OR NEW.reading >= current_hours);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meter_reading_apply
AFTER INSERT ON public.meter_readings
FOR EACH ROW EXECUTE FUNCTION public.apply_meter_reading();
