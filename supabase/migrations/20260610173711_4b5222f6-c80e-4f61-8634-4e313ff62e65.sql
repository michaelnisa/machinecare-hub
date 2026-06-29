
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_system_inbox text,
  ADD COLUMN IF NOT EXISTS notifications_lead_days integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS notifications_notify_managers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_notify_technicians boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_notify_engineers boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.maintenance_email_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  ran_at timestamptz NOT NULL DEFAULT now(),
  due_soon_count integer NOT NULL DEFAULT 0,
  overdue_count integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text
);

GRANT SELECT ON public.maintenance_email_runs TO authenticated;
GRANT ALL ON public.maintenance_email_runs TO service_role;

ALTER TABLE public.maintenance_email_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mer select" ON public.maintenance_email_runs
  FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());

CREATE INDEX IF NOT EXISTS idx_mer_org_time ON public.maintenance_email_runs(organisation_id, ran_at DESC);
