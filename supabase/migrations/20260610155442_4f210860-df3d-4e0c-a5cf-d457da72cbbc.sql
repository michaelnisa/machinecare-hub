
CREATE OR REPLACE FUNCTION public.can_author_templates(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), _org_id, 'owner')
      OR has_role(auth.uid(), _org_id, 'engineer')
$$;

CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  machine_category TEXT,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  parent_template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ct_org_idx ON public.checklist_templates(organisation_id, status);
CREATE INDEX ct_machine_idx ON public.checklist_templates(machine_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ct select" ON public.checklist_templates FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ct insert" ON public.checklist_templates FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_author_templates(current_org_id()));
CREATE POLICY "ct update" ON public.checklist_templates FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_author_templates(current_org_id()));
CREATE POLICY "ct delete" ON public.checklist_templates FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_author_templates(current_org_id()));

CREATE TRIGGER trg_ct_updated_at BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'pass_fail',
  min_value NUMERIC,
  max_value NUMERIC,
  unit TEXT,
  severity TEXT NOT NULL DEFAULT 'minor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cti_template_idx ON public.checklist_template_items(template_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_template_items TO authenticated;
GRANT ALL ON public.checklist_template_items TO service_role;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cti select" ON public.checklist_template_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_templates t WHERE t.id = template_id AND t.organisation_id = current_org_id()));
CREATE POLICY "cti insert" ON public.checklist_template_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_templates t WHERE t.id = template_id AND t.organisation_id = current_org_id() AND can_author_templates(current_org_id())));
CREATE POLICY "cti update" ON public.checklist_template_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_templates t WHERE t.id = template_id AND t.organisation_id = current_org_id() AND can_author_templates(current_org_id())));
CREATE POLICY "cti delete" ON public.checklist_template_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_templates t WHERE t.id = template_id AND t.organisation_id = current_org_id() AND can_author_templates(current_org_id())));
