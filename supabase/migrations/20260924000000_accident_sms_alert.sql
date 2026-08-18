-- Accident/incident reports submitted from the public QR page should page
-- someone immediately, not just wait for a manager to open the Safety
-- module or the in-app notification bell. This adds the tracking column
-- the notify-accident-sms Edge Function uses to (a) avoid double-sending if
-- called twice for the same incident, and (b) record whether/when the SMS
-- actually went out for audit purposes.

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS sms_alert_sent_at timestamptz;
