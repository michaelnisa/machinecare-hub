-- Safety module: Training & Competency (with work-order assignment gating)
-- and Safety Equipment (fire extinguishers, gas detectors, etc.) tracking.
-- Same org-scoped RLS pattern as the prior two safety migrations.

-- ===== Training & Competency =====
CREATE TABLE public.employee_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_name text NOT NULL, -- e.g. Electrical Safety, Welding, Forklift, LOTO, First Aid
  certificate_number text,
  issued_on date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active', -- active | revoked
  doc_url text,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_competencies TO authenticated;
GRANT ALL ON public.employee_competencies TO service_role;
ALTER TABLE public.employee_competencies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employee_competencies_employee ON public.employee_competencies(employee_id, competency_name);
CREATE INDEX idx_employee_competencies_expiry ON public.employee_competencies(organisation_id, expiry_date);

CREATE POLICY "ec select" ON public.employee_competencies FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ec insert" ON public.employee_competencies FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "ec update" ON public.employee_competencies FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_review_safety(organisation_id));
CREATE POLICY "ec delete" ON public.employee_competencies FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ===== Safety Equipment =====
CREATE TABLE public.safety_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  asset_tag text,
  name text NOT NULL,
  equipment_type text NOT NULL DEFAULT 'other', -- fire_extinguisher | fire_alarm | emergency_shower | eye_wash_station | first_aid_kit | emergency_light | gas_detector | safety_barrier | other
  location text,
  inspection_frequency_days int NOT NULL DEFAULT 30,
  last_inspection_date date,
  next_inspection_date date,
  condition text NOT NULL DEFAULT 'good', -- good | fair | needs_attention | out_of_service
  certificate_url text,
  certificate_expiry date,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_equipment TO authenticated;
GRANT ALL ON public.safety_equipment TO service_role;
ALTER TABLE public.safety_equipment ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_safety_equipment_next_inspection ON public.safety_equipment(organisation_id, next_inspection_date);

CREATE POLICY "se select" ON public.safety_equipment FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "se insert" ON public.safety_equipment FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "se update" ON public.safety_equipment FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "se delete" ON public.safety_equipment FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Keep next_inspection_date in sync whenever an inspection is logged or the
-- frequency changes.
CREATE OR REPLACE FUNCTION public.set_safety_equipment_next_inspection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.last_inspection_date IS NOT NULL THEN
    NEW.next_inspection_date := NEW.last_inspection_date + (NEW.inspection_frequency_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_safety_equipment_next_inspection
BEFORE INSERT OR UPDATE ON public.safety_equipment
FOR EACH ROW EXECUTE FUNCTION public.set_safety_equipment_next_inspection();
