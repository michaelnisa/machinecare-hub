-- ============================================================
-- Fleet Trips: Optional direct columns for client orders & routes
-- ============================================================

ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_order_no text,
  ADD COLUMN IF NOT EXISTS route_notes text,
  ADD COLUMN IF NOT EXISTS is_round_trip boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS roundtrip_hours_est numeric,
  ADD COLUMN IF NOT EXISTS estimated_return_at timestamptz;
