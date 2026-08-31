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

-- ── Email Notification Trigger ───────────────────────────────
-- Sends email notification to michaelnisa3@gmail.com when a request is submitted

CREATE OR REPLACE FUNCTION public.handle_new_onboarding_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE
  _message_id text;
  _resolved_subject text;
  _html text;
  _text text;
  _from text;
  _sender_domain text;
BEGIN
  _message_id := gen_random_uuid()::text;
  _resolved_subject := 'New Onboarding Request: ' || NEW.company;
  _from := 'rigwell-pro <noreply@notify.machinecare.co.tz>';
  _sender_domain := 'notify.machinecare.co.tz';

  _html := '<h2>New Onboarding Request Received</h2>' ||
           '<p><strong>Name:</strong> ' || COALESCE(NEW.name, 'N/A') || '</p>' ||
           '<p><strong>Contact:</strong> ' || COALESCE(NEW.contact, 'N/A') || '</p>' ||
           '<p><strong>Company:</strong> ' || COALESCE(NEW.company, 'N/A') || '</p>' ||
           '<p><strong>Industry:</strong> ' || COALESCE(NEW.industry, 'N/A') || '</p>' ||
           '<p><strong>Submitted At:</strong> ' || COALESCE(NEW.created_at::text, 'N/A') || '</p>';

  _text := 'New Onboarding Request Received' || E'\n\n' ||
           'Name: ' || COALESCE(NEW.name, 'N/A') || E'\n' ||
           'Contact: ' || COALESCE(NEW.contact, 'N/A') || E'\n' ||
           'Company: ' || COALESCE(NEW.company, 'N/A') || E'\n' ||
           'Industry: ' || COALESCE(NEW.industry, 'N/A') || E'\n' ||
           'Submitted At: ' || COALESCE(NEW.created_at::text, 'N/A');

  -- 1. Insert into email_send_log
  INSERT INTO public.email_send_log (
    message_id,
    template_name,
    recipient_email,
    status
  ) VALUES (
    _message_id,
    'onboarding-request-notification',
    'michaelnisa3@gmail.com',
    'pending'
  );

  -- 2. Enqueue the email via pgmq
  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'message_id', _message_id,
      'to', 'michaelnisa3@gmail.com',
      'from', _from,
      'sender_domain', _sender_domain,
      'subject', _resolved_subject,
      'html', _html,
      'text', _text,
      'purpose', 'transactional',
      'label', 'onboarding-request-notification',
      'queued_at', now()::text
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_onboarding_request_inserted
  AFTER INSERT ON public.onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_onboarding_request();
