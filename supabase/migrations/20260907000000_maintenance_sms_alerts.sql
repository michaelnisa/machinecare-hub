-- SMS alerting for the maintenance digest, mirroring
-- production_alerts_sms_enabled (kept as a separate flag since a user may
-- want production breach texts without wanting a daily maintenance text,
-- or vice versa).
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS maintenance_alerts_sms_enabled boolean NOT NULL DEFAULT false;
