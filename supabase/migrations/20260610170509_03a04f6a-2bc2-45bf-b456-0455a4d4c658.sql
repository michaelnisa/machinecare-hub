
-- 1. Extend work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS work_type text NOT NULL DEFAULT 'repair',
  ADD COLUMN IF NOT EXISTS checklist_template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wo_year integer;

-- Migrate legacy statuses
UPDATE public.work_orders SET status = 'done' WHERE status = 'completed';
UPDATE public.work_orders SET status = 'closed' WHERE status = 'cancelled';

-- 2. Counters: switch to (org, year)
ALTER TABLE public.org_wo_counters ADD COLUMN IF NOT EXISTS year integer;
UPDATE public.org_wo_counters SET year = EXTRACT(year FROM now())::int WHERE year IS NULL;
ALTER TABLE public.org_wo_counters ALTER COLUMN year SET NOT NULL;
ALTER TABLE public.org_wo_counters DROP CONSTRAINT IF EXISTS org_wo_counters_pkey;
ALTER TABLE public.org_wo_counters ADD PRIMARY KEY (organisation_id, year);

-- Backfill wo_year on existing WOs from created_at
UPDATE public.work_orders SET wo_year = EXTRACT(year FROM created_at)::int WHERE wo_year IS NULL;

-- 3. Update WO number assignment trigger fn (yearly counter)
CREATE OR REPLACE FUNCTION public.assign_wo_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
  y INT := EXTRACT(year FROM COALESCE(NEW.created_at, now()))::int;
BEGIN
  NEW.wo_year := y;
  IF NEW.wo_number IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.org_wo_counters(organisation_id, year, next_number)
    VALUES (NEW.organisation_id, y, 1)
    ON CONFLICT (organisation_id, year) DO NOTHING;
  UPDATE public.org_wo_counters
    SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id AND year = y
    RETURNING next_number - 1 INTO n;
  NEW.wo_number := n;
  RETURN NEW;
END $$;

-- 4. Status history
CREATE TABLE IF NOT EXISTS public.wo_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wo_status_history TO authenticated;
GRANT ALL ON public.wo_status_history TO service_role;

ALTER TABLE public.wo_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wsh select" ON public.wo_status_history
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

CREATE POLICY "wsh insert" ON public.wo_status_history
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(current_org_id()));

CREATE INDEX IF NOT EXISTS wsh_wo_idx ON public.wo_status_history(work_order_id, changed_at);

-- 5. Backfill initial open history for existing WOs
INSERT INTO public.wo_status_history (work_order_id, organisation_id, from_status, to_status, changed_by, changed_at)
SELECT id, organisation_id, NULL, 'open', created_by, created_at
FROM public.work_orders w
WHERE NOT EXISTS (SELECT 1 FROM public.wo_status_history h WHERE h.work_order_id = w.id);

-- 6. Insert-history trigger on new WOs
CREATE OR REPLACE FUNCTION public.wo_insert_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wo_status_history (work_order_id, organisation_id, from_status, to_status, changed_by)
  VALUES (NEW.id, NEW.organisation_id, NULL, NEW.status, COALESCE(NEW.created_by, auth.uid()));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_insert_history ON public.work_orders;
CREATE TRIGGER trg_wo_insert_history
  AFTER INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.wo_insert_history();

-- 7. Transition RPC
CREATE OR REPLACE FUNCTION public.transition_wo(_wo_id uuid, _to text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_from text;
  v_allowed text[];
BEGIN
  SELECT organisation_id, status INTO v_org, v_from FROM public.work_orders WHERE id = _wo_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Work order not found'; END IF;
  IF v_org <> current_org_id() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT can_write(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  -- allowed transitions
  v_allowed := CASE v_from
    WHEN 'open' THEN ARRAY['assigned','in_progress','closed']
    WHEN 'assigned' THEN ARRAY['in_progress','open','closed']
    WHEN 'in_progress' THEN ARRAY['waiting_parts','done','assigned']
    WHEN 'waiting_parts' THEN ARRAY['in_progress','done']
    WHEN 'done' THEN ARRAY['closed','in_progress']
    WHEN 'closed' THEN ARRAY['open']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (_to = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid transition % -> %', v_from, _to;
  END IF;

  IF _to = 'waiting_parts' AND (_note IS NULL OR length(trim(_note)) = 0) THEN
    RAISE EXCEPTION 'A part/reason note is required when moving to waiting_parts';
  END IF;
  IF v_from = 'done' AND _to = 'in_progress' AND (_note IS NULL OR length(trim(_note)) = 0) THEN
    RAISE EXCEPTION 'A reason is required to reopen a completed work order';
  END IF;

  UPDATE public.work_orders
    SET status = _to,
        completed_at = CASE WHEN _to = 'done' THEN now()
                            WHEN _to = 'in_progress' AND v_from = 'done' THEN NULL
                            ELSE completed_at END
    WHERE id = _wo_id;

  INSERT INTO public.wo_status_history (work_order_id, organisation_id, from_status, to_status, note, changed_by)
  VALUES (_wo_id, v_org, v_from, _to, _note, auth.uid());
END $$;

GRANT EXECUTE ON FUNCTION public.transition_wo(uuid, text, text) TO authenticated;
