
-- counters table
CREATE TABLE IF NOT EXISTS public.org_wo_counters (
  organisation_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  next_number INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_wo_counters TO authenticated;
GRANT ALL ON public.org_wo_counters TO service_role;
ALTER TABLE public.org_wo_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read counters" ON public.org_wo_counters
  FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

-- column on work_orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS wo_number INT;
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_org_wo_number_idx ON public.work_orders(organisation_id, wo_number);

-- assign function + trigger
CREATE OR REPLACE FUNCTION public.assign_wo_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  IF NEW.wo_number IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.org_wo_counters(organisation_id, next_number)
    VALUES (NEW.organisation_id, 1)
    ON CONFLICT (organisation_id) DO NOTHING;
  UPDATE public.org_wo_counters
    SET next_number = next_number + 1, updated_at = now()
    WHERE organisation_id = NEW.organisation_id
    RETURNING next_number - 1 INTO n;
  NEW.wo_number := n;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_wo_number ON public.work_orders;
CREATE TRIGGER trg_assign_wo_number
BEFORE INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.assign_wo_number();

-- backfill
DO $$
DECLARE r RECORD; cnt INT;
BEGIN
  FOR r IN SELECT DISTINCT organisation_id FROM public.work_orders WHERE wo_number IS NULL LOOP
    cnt := COALESCE((SELECT MAX(wo_number) FROM public.work_orders WHERE organisation_id = r.organisation_id), 0);
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
      FROM public.work_orders
      WHERE organisation_id = r.organisation_id AND wo_number IS NULL
    )
    UPDATE public.work_orders w
    SET wo_number = cnt + o.rn
    FROM ordered o
    WHERE w.id = o.id;

    INSERT INTO public.org_wo_counters(organisation_id, next_number)
      VALUES (r.organisation_id, (SELECT COALESCE(MAX(wo_number),0)+1 FROM public.work_orders WHERE organisation_id = r.organisation_id))
      ON CONFLICT (organisation_id) DO UPDATE
      SET next_number = GREATEST(public.org_wo_counters.next_number, EXCLUDED.next_number);
  END LOOP;
END $$;
