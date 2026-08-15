ALTER TABLE public.maintenance_email_runs
  ADD COLUMN IF NOT EXISTS sms_sent integer NOT NULL DEFAULT 0;
