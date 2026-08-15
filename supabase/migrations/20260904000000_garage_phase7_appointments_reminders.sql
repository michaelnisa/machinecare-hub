-- Workshop/Garage branch Phase 7 (per garage_workshop.md sections 29/30/31/35):
-- Appointments, Service Reminders, and Customer Communication.
--
-- Section 29 explicitly says "design the architecture so WhatsApp
-- integration can be added" — NOT to build the integration itself. So
-- garage_customer_messages is a message LOG (channel/body/trigger_event/
-- status), logged manually by staff after they've told the customer
-- something (in person, by call, by typing it into WhatsApp themselves).
-- There is no outbound send here; a future automated sender would just be
-- another writer into this same table.

CREATE TABLE public.garage_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.garage_customers(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.garage_vehicles(id) ON DELETE SET NULL,
  mechanic_id uuid REFERENCES public.garage_mechanics(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  purpose text,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | confirmed | completed | cancelled | no_show
  job_id uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_appointments TO authenticated;
GRANT ALL ON public.garage_appointments TO service_role;
ALTER TABLE public.garage_appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_appointments_org_time ON public.garage_appointments(organisation_id, scheduled_at);
CREATE INDEX idx_garage_appointments_customer ON public.garage_appointments(customer_id);

CREATE POLICY "ga select" ON public.garage_appointments FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "ga insert" ON public.garage_appointments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ga update" ON public.garage_appointments FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "ga delete" ON public.garage_appointments FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

CREATE TRIGGER garage_appointments_updated BEFORE UPDATE ON public.garage_appointments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Customer message log (section 29) =====
CREATE TABLE public.garage_customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.garage_customers(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.garage_jobs(id) ON DELETE SET NULL,
  trigger_event text, -- job_received | estimate_ready | approval_request | repair_update | vehicle_ready | invoice | payment_confirmation | service_reminder | custom
  channel text NOT NULL DEFAULT 'whatsapp', -- whatsapp | sms | email | phone_call | in_person | other
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'sent', -- queued | sent | failed
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.garage_customer_messages TO authenticated;
GRANT ALL ON public.garage_customer_messages TO service_role;
ALTER TABLE public.garage_customer_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_garage_customer_messages_customer ON public.garage_customer_messages(customer_id, created_at DESC);
CREATE INDEX idx_garage_customer_messages_job ON public.garage_customer_messages(job_id);

CREATE POLICY "gcm select" ON public.garage_customer_messages FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "gcm insert" ON public.garage_customer_messages FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "gcm update" ON public.garage_customer_messages FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
