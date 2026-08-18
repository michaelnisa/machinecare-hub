-- Manually raising a "critical" floor issue on the Notifications page
-- previously only created the in-app row — nobody got paged. This adds the
-- columns notify-critical-notification-sms uses to record what it actually
-- sent (so the exact SMS text is visible right in the Notifications table,
-- not just on the recipient's phone) and to avoid double-sending.

ALTER TABLE public.maintenance_notifications
  ADD COLUMN IF NOT EXISTS sms_text text,
  ADD COLUMN IF NOT EXISTS sms_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_recipients_count int;
