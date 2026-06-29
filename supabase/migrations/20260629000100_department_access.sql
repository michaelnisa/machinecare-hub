-- ============================================================
-- Department access control
-- ============================================================

-- Add department to user profiles (which team/department they belong to)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- Add department to machines (which department owns/operates this machine)
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS department TEXT;

-- Index for fast department filtering on both tables
CREATE INDEX IF NOT EXISTS idx_profiles_department  ON public.profiles(organisation_id, department);
CREATE INDEX IF NOT EXISTS idx_machines_department  ON public.machines(organisation_id, department);
