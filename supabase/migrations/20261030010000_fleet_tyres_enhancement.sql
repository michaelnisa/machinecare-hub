-- ============================================================
-- Fleet & Logistics: Tyre Management Enhancements
-- Adds truck-specific tyre fields (pressure, pattern, dot_code, cost)
-- ============================================================

ALTER TABLE public.tyres
  ADD COLUMN IF NOT EXISTS pressure_psi numeric,
  ADD COLUMN IF NOT EXISTS initial_tread_mm numeric,
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS dot_code text,
  ADD COLUMN IF NOT EXISTS cost numeric;

COMMENT ON COLUMN public.tyres.serial IS 'Unique tyre serial number / manufacturer identification';
COMMENT ON COLUMN public.tyres.pressure_psi IS 'Measured tyre cold pressure in PSI (standard truck 100-120 PSI)';
COMMENT ON COLUMN public.tyres.pattern IS 'Tyre tread pattern: Steer, Drive, Trailer, All-Position';
COMMENT ON COLUMN public.tyres.dot_code IS 'DOT manufacture code indicating week and year of manufacture';
