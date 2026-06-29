
-- SAFETY INCIDENTS
CREATE TABLE public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL DEFAULT 'near_miss',
  severity TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'open',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  persons_involved TEXT,
  description TEXT NOT NULL,
  immediate_action TEXT,
  corrective_action TEXT,
  lost_time_hours NUMERIC DEFAULT 0,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_incidents TO authenticated;
GRANT ALL ON public.safety_incidents TO service_role;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si select" ON public.safety_incidents FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "si insert" ON public.safety_incidents FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "si update" ON public.safety_incidents FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "si delete" ON public.safety_incidents FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE TRIGGER safety_incidents_updated BEFORE UPDATE ON public.safety_incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- QUALITY REPORTS
CREATE TABLE public.quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product TEXT,
  units_inspected INT NOT NULL DEFAULT 0,
  units_defective INT NOT NULL DEFAULT 0,
  units_rework INT NOT NULL DEFAULT 0,
  units_scrap INT NOT NULL DEFAULT 0,
  defect_category TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  inspector TEXT,
  notes TEXT,
  yield_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN units_inspected > 0
      THEN ROUND(((units_inspected - units_defective)::numeric / units_inspected) * 100, 2)
      ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_reports TO authenticated;
GRANT ALL ON public.quality_reports TO service_role;
ALTER TABLE public.quality_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr select" ON public.quality_reports FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "qr insert" ON public.quality_reports FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "qr update" ON public.quality_reports FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "qr delete" ON public.quality_reports FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE TRIGGER quality_reports_updated BEFORE UPDATE ON public.quality_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PRODUCTION KPIs
CREATE TABLE public.production_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT,
  product TEXT,
  target_units INT NOT NULL DEFAULT 0,
  actual_units INT NOT NULL DEFAULT 0,
  scrap_units INT NOT NULL DEFAULT 0,
  downtime_minutes INT NOT NULL DEFAULT 0,
  operator TEXT,
  notes TEXT,
  attainment_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN target_units > 0 THEN ROUND((actual_units::numeric / target_units) * 100, 2) ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_kpis TO authenticated;
GRANT ALL ON public.production_kpis TO service_role;
ALTER TABLE public.production_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pk select" ON public.production_kpis FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "pk insert" ON public.production_kpis FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pk update" ON public.production_kpis FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "pk delete" ON public.production_kpis FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE TRIGGER production_kpis_updated BEFORE UPDATE ON public.production_kpis FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- UTILITIES KPIs
CREATE TABLE public.utilities_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  utility_type TEXT NOT NULL DEFAULT 'electricity',
  consumption NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kWh',
  cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  meter_reading NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utilities_kpis TO authenticated;
GRANT ALL ON public.utilities_kpis TO service_role;
ALTER TABLE public.utilities_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uk select" ON public.utilities_kpis FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "uk insert" ON public.utilities_kpis FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "uk update" ON public.utilities_kpis FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "uk delete" ON public.utilities_kpis FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE TRIGGER utilities_kpis_updated BEFORE UPDATE ON public.utilities_kpis FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
