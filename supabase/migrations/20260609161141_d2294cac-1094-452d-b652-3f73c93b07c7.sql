
-- Maintenance notifications
CREATE TABLE public.maintenance_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_notifications TO authenticated;
GRANT ALL ON public.maintenance_notifications TO service_role;

ALTER TABLE public.maintenance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mn select org" ON public.maintenance_notifications FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());
CREATE POLICY "mn insert writer" ON public.maintenance_notifications FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id));
CREATE POLICY "mn update manager" ON public.maintenance_notifications FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_manage(organisation_id))
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "mn delete manager" ON public.maintenance_notifications FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_manage(organisation_id));

CREATE TRIGGER tr_mn_updated BEFORE UPDATE ON public.maintenance_notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_mn_org ON public.maintenance_notifications(organisation_id, status);
CREATE INDEX idx_mn_machine ON public.maintenance_notifications(machine_id);

-- OEE records
CREATE TABLE public.oee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  planned_minutes NUMERIC NOT NULL,
  downtime_minutes NUMERIC NOT NULL DEFAULT 0,
  units_produced NUMERIC NOT NULL DEFAULT 0,
  units_good NUMERIC NOT NULL DEFAULT 0,
  ideal_cycle_seconds NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  availability NUMERIC GENERATED ALWAYS AS (
    CASE WHEN planned_minutes > 0
      THEN GREATEST(0, LEAST(100, ((planned_minutes - downtime_minutes) / planned_minutes) * 100))
      ELSE 0 END
  ) STORED,
  performance NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (planned_minutes - downtime_minutes) > 0 AND ideal_cycle_seconds > 0
      THEN GREATEST(0, LEAST(100, ((ideal_cycle_seconds * units_produced) / ((planned_minutes - downtime_minutes) * 60)) * 100))
      ELSE 0 END
  ) STORED,
  quality NUMERIC GENERATED ALWAYS AS (
    CASE WHEN units_produced > 0
      THEN GREATEST(0, LEAST(100, (units_good / units_produced) * 100))
      ELSE 0 END
  ) STORED,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_id, record_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oee_records TO authenticated;
GRANT ALL ON public.oee_records TO service_role;

ALTER TABLE public.oee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oee select org" ON public.oee_records FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());
CREATE POLICY "oee insert writer" ON public.oee_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id));
CREATE POLICY "oee update writer" ON public.oee_records FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id))
  WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "oee delete manager" ON public.oee_records FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_manage(organisation_id));

CREATE TRIGGER tr_oee_updated BEFORE UPDATE ON public.oee_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_oee_machine_date ON public.oee_records(machine_id, record_date DESC);
CREATE INDEX idx_oee_org_date ON public.oee_records(organisation_id, record_date DESC);
