
-- INDUCTION PROGRAMMES
CREATE TABLE public.induction_programmes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
  name TEXT NOT NULL,
  inductee_type TEXT NOT NULL DEFAULT 'employee',
  description TEXT,
  pass_mark_percent INT NOT NULL DEFAULT 80,
  validity_days INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_programmes TO authenticated;
GRANT ALL ON public.induction_programmes TO service_role;
ALTER TABLE public.induction_programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip select" ON public.induction_programmes FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "ip insert" ON public.induction_programmes FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "ip update" ON public.induction_programmes FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "ip delete" ON public.induction_programmes FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- helper: programme in current org
CREATE OR REPLACE FUNCTION public.programme_in_org(_programme_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.induction_programmes WHERE id = _programme_id AND organisation_id = current_org_id())
$$;

-- INDUCTION MODULES
CREATE TABLE public.induction_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programme_id UUID NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_text TEXT,
  video_url TEXT,
  document_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  has_quiz BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_modules TO authenticated;
GRANT ALL ON public.induction_modules TO service_role;
ALTER TABLE public.induction_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "im select" ON public.induction_modules FOR SELECT TO authenticated USING (programme_in_org(programme_id));
CREATE POLICY "im insert" ON public.induction_modules FOR INSERT TO authenticated WITH CHECK (programme_in_org(programme_id) AND can_manage(current_org_id()));
CREATE POLICY "im update" ON public.induction_modules FOR UPDATE TO authenticated USING (programme_in_org(programme_id) AND can_manage(current_org_id()));
CREATE POLICY "im delete" ON public.induction_modules FOR DELETE TO authenticated USING (programme_in_org(programme_id) AND can_manage(current_org_id()));

-- helper: module in org
CREATE OR REPLACE FUNCTION public.module_in_org(_module_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.induction_modules m
    JOIN public.induction_programmes p ON p.id = m.programme_id
    WHERE m.id = _module_id AND p.organisation_id = current_org_id()
  )
$$;

-- QUIZ QUESTIONS
CREATE TABLE public.induction_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_quiz_questions TO authenticated;
GRANT ALL ON public.induction_quiz_questions TO service_role;
ALTER TABLE public.induction_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iq select" ON public.induction_quiz_questions FOR SELECT TO authenticated USING (module_in_org(module_id));
CREATE POLICY "iq insert" ON public.induction_quiz_questions FOR INSERT TO authenticated WITH CHECK (module_in_org(module_id) AND can_manage(current_org_id()));
CREATE POLICY "iq update" ON public.induction_quiz_questions FOR UPDATE TO authenticated USING (module_in_org(module_id) AND can_manage(current_org_id()));
CREATE POLICY "iq delete" ON public.induction_quiz_questions FOR DELETE TO authenticated USING (module_in_org(module_id) AND can_manage(current_org_id()));

-- INDUCTEES
CREATE TABLE public.inductees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  id_number TEXT,
  inductee_type TEXT NOT NULL DEFAULT 'employee',
  company TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inductees TO authenticated;
GRANT ALL ON public.inductees TO service_role;
ALTER TABLE public.inductees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind select" ON public.inductees FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "ind insert" ON public.inductees FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ind update" ON public.inductees FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ind delete" ON public.inductees FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- INDUCTION RECORDS
CREATE TABLE public.induction_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inductee_id UUID NOT NULL,
  programme_id UUID NOT NULL,
  organisation_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  overall_score_percent NUMERIC,
  digital_signature_url TEXT,
  expires_at DATE,
  inducted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_records TO authenticated;
GRANT ALL ON public.induction_records TO service_role;
ALTER TABLE public.induction_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ir select" ON public.induction_records FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "ir insert" ON public.induction_records FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ir update" ON public.induction_records FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ir delete" ON public.induction_records FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- compute expires_at trigger
CREATE OR REPLACE FUNCTION public.set_induction_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days INT;
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
    SELECT validity_days INTO v_days FROM public.induction_programmes WHERE id = NEW.programme_id;
    IF v_days IS NOT NULL THEN
      NEW.expires_at := (NEW.completed_at::date + v_days);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_induction_expiry BEFORE INSERT OR UPDATE ON public.induction_records
  FOR EACH ROW EXECUTE FUNCTION public.set_induction_expiry();

-- MODULE RESULTS
CREATE TABLE public.induction_module_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  induction_record_id UUID NOT NULL,
  module_id UUID NOT NULL,
  score_percent NUMERIC NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answers_given JSONB NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_module_results TO authenticated;
GRANT ALL ON public.induction_module_results TO service_role;
ALTER TABLE public.induction_module_results ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_in_org(_record_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.induction_records WHERE id = _record_id AND organisation_id = current_org_id())
$$;

CREATE POLICY "imr select" ON public.induction_module_results FOR SELECT TO authenticated USING (record_in_org(induction_record_id));
CREATE POLICY "imr insert" ON public.induction_module_results FOR INSERT TO authenticated WITH CHECK (record_in_org(induction_record_id) AND can_write(current_org_id()));
CREATE POLICY "imr update" ON public.induction_module_results FOR UPDATE TO authenticated USING (record_in_org(induction_record_id) AND can_write(current_org_id()));
CREATE POLICY "imr delete" ON public.induction_module_results FOR DELETE TO authenticated USING (record_in_org(induction_record_id) AND can_manage(current_org_id()));

-- REMINDERS
CREATE TABLE public.induction_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
  induction_record_id UUID NOT NULL,
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminded_by UUID,
  channel TEXT NOT NULL DEFAULT 'manual'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.induction_reminders TO authenticated;
GRANT ALL ON public.induction_reminders TO service_role;
ALTER TABLE public.induction_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "irem select" ON public.induction_reminders FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "irem insert" ON public.induction_reminders FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('induction-assets', 'induction-assets', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "induction assets read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'induction-assets');
CREATE POLICY "induction assets insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'induction-assets');
CREATE POLICY "induction assets update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'induction-assets');
CREATE POLICY "induction assets delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'induction-assets');

-- touch updated_at
CREATE TRIGGER trg_ip_touch BEFORE UPDATE ON public.induction_programmes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_im_touch BEFORE UPDATE ON public.induction_modules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ind_touch BEFORE UPDATE ON public.inductees FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
