-- ============================================================
-- Fleet & Logistics — Trip Expenses, Fines & Driver Cost Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  expense_type text NOT NULL CHECK (expense_type IN ('fine', 'receipt', 'toll', 'parking', 'fuel', 'repair', 'other')),
  title text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  reference_number text,
  receipt_url text,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_expenses TO authenticated;
GRANT SELECT, INSERT ON public.trip_expenses TO anon;
GRANT ALL ON public.trip_expenses TO service_role;

ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view trip expenses" ON public.trip_expenses;
CREATE POLICY "org members can view trip expenses"
ON public.trip_expenses FOR SELECT
TO authenticated
USING (organisation_id = public.current_org_id());

DROP POLICY IF EXISTS "anon can view trip expenses" ON public.trip_expenses;
CREATE POLICY "anon can view trip expenses"
ON public.trip_expenses FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "org writers can insert trip expenses" ON public.trip_expenses;
CREATE POLICY "org writers can insert trip expenses"
ON public.trip_expenses FOR INSERT
TO authenticated
WITH CHECK (public.can_write(organisation_id));

DROP POLICY IF EXISTS "anon can insert trip expenses" ON public.trip_expenses;
CREATE POLICY "anon can insert trip expenses"
ON public.trip_expenses FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_id AND t.organisation_id = organisation_id
  )
);

DROP POLICY IF EXISTS "org writers can update trip expenses" ON public.trip_expenses;
CREATE POLICY "org writers can update trip expenses"
ON public.trip_expenses FOR UPDATE
TO authenticated
USING (public.can_write(organisation_id))
WITH CHECK (public.can_write(organisation_id));

DROP POLICY IF EXISTS "org managers can delete trip expenses" ON public.trip_expenses;
CREATE POLICY "org managers can delete trip expenses"
ON public.trip_expenses FOR DELETE
TO authenticated
USING (public.can_manage(organisation_id));

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip ON public.trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_machine ON public.trip_expenses(machine_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_driver ON public.trip_expenses(driver_id);

-- Storage policy for trip receipt / fine uploads
CREATE POLICY "Anon upload trip receipt photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'machine-docs'
    AND (storage.foldername(name))[2] = 'trips'
  );

-- Helper RPC: Add trip expense / fine
CREATE OR REPLACE FUNCTION public.add_trip_expense_public(
  _trip_id uuid,
  _expense_type text,
  _title text,
  _amount numeric,
  _reference_number text DEFAULT NULL,
  _receipt_url text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = _trip_id;
  IF v_trip.id IS NULL THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;

  INSERT INTO public.trip_expenses (
    organisation_id,
    trip_id,
    machine_id,
    driver_id,
    expense_type,
    title,
    amount,
    reference_number,
    receipt_url,
    notes
  ) VALUES (
    v_trip.organisation_id,
    v_trip.id,
    v_trip.machine_id,
    v_trip.driver_id,
    _expense_type,
    COALESCE(_title, initcap(_expense_type)),
    _amount,
    _reference_number,
    _receipt_url,
    _notes
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_trip_expense_public(uuid, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_trip_expense_public(uuid, text, text, numeric, text, text, text) TO anon, authenticated;

-- Helper RPC: Get active trip for scanned vehicle
CREATE OR REPLACE FUNCTION public.get_active_trip_for_machine_public(_machine_id uuid)
RETURNS TABLE (
  trip_id uuid,
  organisation_id uuid,
  machine_id uuid,
  driver_id uuid,
  driver_name text,
  purpose text,
  origin text,
  destination text,
  start_odo numeric,
  start_at timestamptz,
  fuel_used_l numeric,
  fuel_cost numeric,
  status text,
  total_expenses_cost numeric,
  total_fines_cost numeric,
  total_receipts_cost numeric,
  expenses_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS trip_id,
    t.organisation_id,
    t.machine_id,
    t.driver_id,
    d.full_name AS driver_name,
    t.purpose,
    t.origin,
    t.destination,
    t.start_odo,
    t.start_at,
    t.fuel_used_l,
    t.cost AS fuel_cost,
    t.status,
    COALESCE((SELECT SUM(e.amount) FROM public.trip_expenses e WHERE e.trip_id = t.id), 0) AS total_expenses_cost,
    COALESCE((SELECT SUM(e.amount) FROM public.trip_expenses e WHERE e.trip_id = t.id AND e.expense_type = 'fine'), 0) AS total_fines_cost,
    COALESCE((SELECT SUM(e.amount) FROM public.trip_expenses e WHERE e.trip_id = t.id AND e.expense_type <> 'fine'), 0) AS total_receipts_cost,
    (SELECT COUNT(*) FROM public.trip_expenses e WHERE e.trip_id = t.id) AS expenses_count
  FROM public.trips t
  LEFT JOIN public.drivers d ON d.id = t.driver_id
  WHERE t.machine_id = _machine_id AND t.status = 'in_progress'
  ORDER BY t.start_at DESC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_trip_for_machine_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_trip_for_machine_public(uuid) TO anon, authenticated;

-- Helper RPC: Get expenses for a trip
CREATE OR REPLACE FUNCTION public.get_trip_expenses_public(_trip_id uuid)
RETURNS TABLE (
  id uuid,
  trip_id uuid,
  expense_type text,
  title text,
  amount numeric,
  currency text,
  reference_number text,
  receipt_url text,
  notes text,
  occurred_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.trip_id,
    e.expense_type,
    e.title,
    e.amount,
    e.currency,
    e.reference_number,
    e.receipt_url,
    e.notes,
    e.occurred_at,
    e.created_at
  FROM public.trip_expenses e
  WHERE e.trip_id = _trip_id
  ORDER BY e.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_trip_expenses_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trip_expenses_public(uuid) TO anon, authenticated;
