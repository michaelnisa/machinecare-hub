-- Production alert delivery: real email (send-production-alert edge
-- function, invoked from Production.tsx right after a log is saved) plus
-- optional SMS via Africa's Talking for critical breaches only. See
-- supabase/functions/send-production-alert and supabase/functions/send-sms.
--
-- This migration only adds the pieces the database itself needs to own:
-- the org-level opt-in for SMS spend, an SMS send log for auditability
-- (mirrors email_send_log), and a severity split (critical vs high) on the
-- in-app notification so the bell matches what the email says.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS production_alerts_sms_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sms_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'africastalking',
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sms_send_log TO service_role;
ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms log service role only" ON public.sms_send_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE INDEX idx_sms_send_log_created ON public.sms_send_log(created_at DESC);

-- Severity split: "critical" when a shift is at less than half the
-- attainment threshold, or downtime is more than double the threshold —
-- the same thresholds send-production-alert recomputes for the email/SMS
-- decision, so the bell and the email always agree.
CREATE OR REPLACE FUNCTION public.check_production_thresholds()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_att_threshold numeric;
  v_downtime_threshold numeric;
  v_machine_name text;
  v_attainment_breach boolean;
  v_downtime_breach boolean;
  v_severity text;
BEGIN
  SELECT production_alert_attainment_threshold, production_alert_downtime_minutes
    INTO v_att_threshold, v_downtime_threshold
    FROM public.organisations WHERE id = NEW.organisation_id;

  IF v_att_threshold IS NULL AND v_downtime_threshold IS NULL THEN
    RETURN NEW;
  END IF;

  v_attainment_breach := v_att_threshold IS NOT NULL AND NEW.target_units > 0 AND NEW.attainment_percent < v_att_threshold;
  v_downtime_breach := v_downtime_threshold IS NOT NULL AND NEW.downtime_minutes > v_downtime_threshold;

  IF v_attainment_breach OR v_downtime_breach THEN
    v_severity := CASE
      WHEN (v_attainment_breach AND NEW.attainment_percent < v_att_threshold * 0.5)
        OR (v_downtime_breach AND NEW.downtime_minutes > v_downtime_threshold * 2)
      THEN 'critical' ELSE 'high'
    END;

    SELECT name INTO v_machine_name FROM public.machines WHERE id = NEW.machine_id;

    INSERT INTO public.maintenance_notifications (
      organisation_id, machine_id, title, description, severity, work_order_id
    ) VALUES (
      NEW.organisation_id,
      NEW.machine_id,
      'Production shortfall — ' || coalesce(v_machine_name, 'unassigned machine') || ' (' || NEW.record_date || coalesce(' ' || NEW.shift, '') || ')',
      'Attainment ' || round(coalesce(NEW.attainment_percent, 0), 1) || '%, downtime ' || NEW.downtime_minutes || ' min.',
      v_severity,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;
