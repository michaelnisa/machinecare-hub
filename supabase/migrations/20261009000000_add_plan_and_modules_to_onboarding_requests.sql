-- ============================================================
-- Add plan and enabled_modules columns to onboarding_requests
-- ============================================================

ALTER TABLE public.onboarding_requests 
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS enabled_modules text[] DEFAULT '{}';

-- Grant privileges for newly added columns
GRANT SELECT, INSERT, UPDATE ON public.onboarding_requests TO anon, authenticated;
GRANT ALL ON public.onboarding_requests TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
