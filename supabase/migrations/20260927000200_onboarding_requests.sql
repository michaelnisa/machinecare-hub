-- ============================================================
-- Onboarding Requests / Lead Intake Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  contact         text NOT NULL,
  company         text NOT NULL,
  industry        text NOT NULL,
  status          text NOT NULL DEFAULT 'pending', -- 'pending' | 'contacted' | 'completed' | 'rejected'
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Grant privileges
GRANT INSERT ON public.onboarding_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.onboarding_requests TO authenticated;
GRANT ALL ON public.onboarding_requests TO service_role;

-- Enable RLS
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public insert to onboarding_requests" 
  ON public.onboarding_requests 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated view of onboarding_requests" 
  ON public.onboarding_requests 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated update of onboarding_requests" 
  ON public.onboarding_requests 
  FOR UPDATE 
  TO authenticated 
  USING (true);
