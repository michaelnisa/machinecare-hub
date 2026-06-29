
CREATE TABLE IF NOT EXISTS public.work_order_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL,
  label text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_id uuid,
  position int NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_tasks_wo ON public.work_order_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_tasks_org ON public.work_order_tasks(organisation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_tasks TO authenticated;
GRANT ALL ON public.work_order_tasks TO service_role;

ALTER TABLE public.work_order_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_tasks select org" ON public.work_order_tasks
  FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

CREATE POLICY "wo_tasks insert" ON public.work_order_tasks
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id() AND public.can_write(organisation_id));

CREATE POLICY "wo_tasks update" ON public.work_order_tasks
  FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id));

CREATE POLICY "wo_tasks delete" ON public.work_order_tasks
  FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id() AND public.can_write(organisation_id));

CREATE TRIGGER trg_wo_tasks_touch BEFORE UPDATE ON public.work_order_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.populate_wo_tasks_from_pm(_wo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_machine uuid;
  v_work_type text;
  v_count int := 0;
  v_pos int := 0;
  r RECORD;
BEGIN
  SELECT organisation_id, machine_id, work_type
    INTO v_org, v_machine, v_work_type
    FROM public.work_orders WHERE id = _wo_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Work order not found'; END IF;
  IF v_org <> public.current_org_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  -- Tasks from service schedules
  FOR r IN
    SELECT id, name, service_type
      FROM public.service_schedules
     WHERE machine_id = v_machine
     ORDER BY name
  LOOP
    v_pos := v_pos + 1;
    INSERT INTO public.work_order_tasks (work_order_id, organisation_id, label, source, source_id, position, created_by)
    VALUES (_wo_id, v_org,
            r.name || COALESCE(' (' || r.service_type || ')', ''),
            'pm_schedule', r.id, v_pos, auth.uid())
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Tasks from PM parts (replace / inspect parts)
  FOR r IN
    SELECT id, part_name, part_number, quantity, unit
      FROM public.machine_pm_parts
     WHERE machine_id = v_machine
     ORDER BY part_name
  LOOP
    v_pos := v_pos + 1;
    INSERT INTO public.work_order_tasks (work_order_id, organisation_id, label, source, source_id, position, created_by)
    VALUES (_wo_id, v_org,
            'Replace / check: ' || r.part_name
              || COALESCE(' [' || r.part_number || ']', '')
              || ' — ' || r.quantity::text || ' ' || r.unit,
            'pm_part', r.id, v_pos, auth.uid());
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_wo_tasks_from_pm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_wo_tasks_from_pm(uuid) TO authenticated;
