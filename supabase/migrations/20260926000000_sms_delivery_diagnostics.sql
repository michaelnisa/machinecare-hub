-- Both notify-critical-notification-sms and notify-accident-sms were
-- marking sms_alert_sent_at as if the SMS succeeded even when the send to
-- Africa's Talking actually failed (no check on the per-recipient result
-- before writing the "sent" columns) — so the Notifications table showed a
-- confident "SMS sent" line while nothing had actually gone out, and there
-- was no record anywhere of *why* it failed. Adds a column to capture the
-- real per-attempt error so failures are visible in-app instead of only in
-- Edge Function logs.

ALTER TABLE public.maintenance_notifications
  ADD COLUMN IF NOT EXISTS sms_error text;

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS sms_error text;
