-- ============================================================
-- Garage: Job Photos + Intake Inspection Checklist
-- ============================================================

-- ── Job Photos ────────────────────────────────────────────────
-- Mechanics can attach photos at any stage of the job
-- (intake damage, diagnosis, work in progress, completion).
-- Photos are stored in the existing machine-docs bucket under
-- {org_id}/garage/{job_id}/ so existing storage policies cover them.

CREATE TABLE IF NOT EXISTS public.garage_job_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  file_url        text NOT NULL,
  caption         text,
  stage           text NOT NULL DEFAULT 'general',
  -- 'intake' | 'diagnosis' | 'in_progress' | 'completion' | 'general'
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.garage_job_photos TO authenticated;
GRANT ALL ON public.garage_job_photos TO service_role;
ALTER TABLE public.garage_job_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_garage_job_photos_job ON public.garage_job_photos(job_id, created_at);

CREATE OR REPLACE FUNCTION public.garage_job_in_org_2(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.garage_jobs WHERE id = _job_id AND organisation_id = current_org_id()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.garage_job_in_org_2(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.garage_job_in_org_2(uuid) TO authenticated;

CREATE POLICY "photo select" ON public.garage_job_photos FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "photo insert" ON public.garage_job_photos FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "photo delete" ON public.garage_job_photos FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND (uploaded_by = auth.uid() OR can_manage(organisation_id)));

-- ── Intake Inspection Checklist ───────────────────────────────
-- One record per job, capturing vehicle condition at intake
-- so disputes about pre-existing damage can be resolved.

CREATE TABLE IF NOT EXISTS public.garage_intake_checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL UNIQUE REFERENCES public.garage_jobs(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  -- Fuel level: 0=empty 1=¼ 2=½ 3=¾ 4=full
  fuel_level      int CHECK (fuel_level BETWEEN 0 AND 4),

  -- Mileage confirmed at intake
  mileage         numeric,

  -- Exterior damage flags (tick any that apply)
  damage_front    boolean NOT NULL DEFAULT false,
  damage_rear     boolean NOT NULL DEFAULT false,
  damage_left     boolean NOT NULL DEFAULT false,
  damage_right    boolean NOT NULL DEFAULT false,
  damage_roof     boolean NOT NULL DEFAULT false,
  damage_notes    text,

  -- Items in vehicle
  radio_present           boolean NOT NULL DEFAULT true,
  spare_tyre_present      boolean NOT NULL DEFAULT true,
  jack_present            boolean NOT NULL DEFAULT true,
  vehicle_documents_present boolean NOT NULL DEFAULT true,
  other_items             text,   -- free text, e.g. "sunglasses, phone charger"

  general_notes   text,

  inspected_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.garage_intake_checklists TO authenticated;
GRANT ALL ON public.garage_intake_checklists TO service_role;
ALTER TABLE public.garage_intake_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake select" ON public.garage_intake_checklists FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "intake insert" ON public.garage_intake_checklists FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "intake update" ON public.garage_intake_checklists FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));

CREATE TRIGGER intake_updated BEFORE UPDATE ON public.garage_intake_checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
