-- ============================================================
-- Fleet & Logistics: Trailers, Driver KYC & Next of Kin, Trip Client Orders & Roundtrip Tracking
-- ============================================================

-- 1. Machines: vehicle type, trailer hitch details, and multi-tank capacities
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS has_trailer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trailer_plate text,
  ADD COLUMN IF NOT EXISTS trailer_make_model text,
  ADD COLUMN IF NOT EXISTS head_tank_capacity_l numeric,
  ADD COLUMN IF NOT EXISTS trailer_tank_capacity_l numeric,
  ADD COLUMN IF NOT EXISTS total_tank_capacity_l numeric;

-- 2. Drivers: passport, NIDA, secondary ID, and Next of Kin verification
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS nida_number text,
  ADD COLUMN IF NOT EXISTS other_id_type text,
  ADD COLUMN IF NOT EXISTS other_id_number text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relation text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS next_of_kin_nida text,
  ADD COLUMN IF NOT EXISTS next_of_kin_photo_url text;

-- 3. Trips: client order details, route / destination instructions, roundtrip turnaround tracking
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_order_no text,
  ADD COLUMN IF NOT EXISTS is_round_trip boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS roundtrip_hours_est numeric,
  ADD COLUMN IF NOT EXISTS estimated_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS route_notes text;
