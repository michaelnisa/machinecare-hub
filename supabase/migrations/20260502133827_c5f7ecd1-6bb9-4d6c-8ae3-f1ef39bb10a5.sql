-- ============================================================
-- Batch 1: Security & Auth hardening
-- 1) Stop auto-creating org on signup if user is joining via invite
-- 2) Invite system (org_invites table)
-- 3) Tighten RLS: destructive ops require owner/manager
-- 4) Restrict role grants from {public} to {authenticated} where appropriate
-- ============================================================

-- ---------- 1) ORG INVITES ----------
CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.org_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.org_invites (organisation_id);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Owners/managers in the org can manage invites
CREATE POLICY "invites manage by managers" ON public.org_invites
FOR ALL TO authenticated
USING (
  organisation_id = current_org_id()
  AND (has_role(auth.uid(), organisation_id, 'owner') OR has_role(auth.uid(), organisation_id, 'manager'))
)
WITH CHECK (
  organisation_id = current_org_id()
  AND (has_role(auth.uid(), organisation_id, 'owner') OR has_role(auth.uid(), organisation_id, 'manager'))
);

-- A signed-in user can read invites addressed to their own email (to accept)
CREATE POLICY "invites read by recipient" ON public.org_invites
FOR SELECT TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')::text));

-- ---------- 2) handle_new_user: respect invite ----------
-- If raw_user_meta_data contains invite_token, attach user to that org instead of creating one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_token TEXT;
  invite_row public.org_invites%ROWTYPE;
  new_org_id UUID;
  org_name TEXT;
  full_name TEXT;
  assigned_role app_role;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_row FROM public.org_invites
      WHERE token = invite_token
        AND status = 'pending'
        AND expires_at > now()
        AND lower(email) = lower(NEW.email)
      LIMIT 1;

    IF invite_row.id IS NOT NULL THEN
      assigned_role := invite_row.role;
      INSERT INTO public.profiles (id, organisation_id, full_name, role)
      VALUES (NEW.id, invite_row.organisation_id, full_name, assigned_role::text);
      INSERT INTO public.user_roles (user_id, organisation_id, role)
      VALUES (NEW.id, invite_row.organisation_id, assigned_role);

      UPDATE public.org_invites
      SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
      WHERE id = invite_row.id;

      RETURN NEW;
    END IF;
  END IF;

  -- Default: create new org and make user owner
  org_name := COALESCE(NEW.raw_user_meta_data->>'organisation_name', 'My Company');
  INSERT INTO public.organisations (name, industry)
  VALUES (org_name, COALESCE(NEW.raw_user_meta_data->>'industry', 'Other'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organisation_id, full_name, role)
  VALUES (NEW.id, new_org_id, full_name, 'owner');

  INSERT INTO public.user_roles (user_id, organisation_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;

-- Re-attach trigger if missing
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 3) Helper: can_manage (owner or manager) ----------
CREATE OR REPLACE FUNCTION public.can_manage(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), _org_id, 'owner') OR has_role(auth.uid(), _org_id, 'manager')
$$;

CREATE OR REPLACE FUNCTION public.can_write(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), _org_id, 'owner')
      OR has_role(auth.uid(), _org_id, 'manager')
      OR has_role(auth.uid(), _org_id, 'technician')
$$;

-- ---------- 4) Tighten policies on machines ----------
DROP POLICY IF EXISTS "Org members select machines" ON public.machines;
DROP POLICY IF EXISTS "Org members insert machines" ON public.machines;
DROP POLICY IF EXISTS "Org members update machines" ON public.machines;
DROP POLICY IF EXISTS "Org members delete machines" ON public.machines;

CREATE POLICY "machines select" ON public.machines FOR SELECT TO authenticated
USING (organisation_id = current_org_id());
CREATE POLICY "machines insert" ON public.machines FOR INSERT TO authenticated
WITH CHECK (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "machines update" ON public.machines FOR UPDATE TO authenticated
USING (organisation_id = current_org_id() AND can_manage(organisation_id));
CREATE POLICY "machines delete" ON public.machines FOR DELETE TO authenticated
USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- ---------- service_schedules ----------
DROP POLICY IF EXISTS "ss select" ON public.service_schedules;
DROP POLICY IF EXISTS "ss insert" ON public.service_schedules;
DROP POLICY IF EXISTS "ss update" ON public.service_schedules;
DROP POLICY IF EXISTS "ss delete" ON public.service_schedules;
CREATE POLICY "ss select" ON public.service_schedules FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "ss insert" ON public.service_schedules FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_manage(current_org_id()));
CREATE POLICY "ss update" ON public.service_schedules FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));
CREATE POLICY "ss delete" ON public.service_schedules FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- service_logs (technicians can write, only managers delete) ----------
DROP POLICY IF EXISTS "sl select" ON public.service_logs;
DROP POLICY IF EXISTS "sl insert" ON public.service_logs;
DROP POLICY IF EXISTS "sl update" ON public.service_logs;
DROP POLICY IF EXISTS "sl delete" ON public.service_logs;
CREATE POLICY "sl select" ON public.service_logs FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "sl insert" ON public.service_logs FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "sl update" ON public.service_logs FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "sl delete" ON public.service_logs FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- service_parts (mirror service_logs) ----------
DROP POLICY IF EXISTS "sp select" ON public.service_parts;
DROP POLICY IF EXISTS "sp insert" ON public.service_parts;
DROP POLICY IF EXISTS "sp update" ON public.service_parts;
DROP POLICY IF EXISTS "sp delete" ON public.service_parts;
CREATE POLICY "sp select" ON public.service_parts FOR SELECT TO authenticated USING (log_in_org(service_log_id));
CREATE POLICY "sp insert" ON public.service_parts FOR INSERT TO authenticated WITH CHECK (log_in_org(service_log_id) AND can_write(current_org_id()));
CREATE POLICY "sp update" ON public.service_parts FOR UPDATE TO authenticated USING (log_in_org(service_log_id) AND can_write(current_org_id()));
CREATE POLICY "sp delete" ON public.service_parts FOR DELETE TO authenticated USING (log_in_org(service_log_id) AND can_manage(current_org_id()));

-- ---------- documents ----------
DROP POLICY IF EXISTS "doc select" ON public.documents;
DROP POLICY IF EXISTS "doc insert" ON public.documents;
DROP POLICY IF EXISTS "doc update" ON public.documents;
DROP POLICY IF EXISTS "doc delete" ON public.documents;
CREATE POLICY "doc select" ON public.documents FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "doc insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "doc update" ON public.documents FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "doc delete" ON public.documents FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- knowledge_items ----------
DROP POLICY IF EXISTS "ki select" ON public.knowledge_items;
DROP POLICY IF EXISTS "ki insert" ON public.knowledge_items;
DROP POLICY IF EXISTS "ki update" ON public.knowledge_items;
DROP POLICY IF EXISTS "ki delete" ON public.knowledge_items;
CREATE POLICY "ki select" ON public.knowledge_items FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "ki insert" ON public.knowledge_items FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "ki update" ON public.knowledge_items FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "ki delete" ON public.knowledge_items FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- fuel_logs ----------
DROP POLICY IF EXISTS "fuel select" ON public.fuel_logs;
DROP POLICY IF EXISTS "fuel insert" ON public.fuel_logs;
DROP POLICY IF EXISTS "fuel update" ON public.fuel_logs;
DROP POLICY IF EXISTS "fuel delete" ON public.fuel_logs;
CREATE POLICY "fuel select" ON public.fuel_logs FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "fuel insert" ON public.fuel_logs FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "fuel update" ON public.fuel_logs FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "fuel delete" ON public.fuel_logs FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- inventory_items ----------
DROP POLICY IF EXISTS "inv select" ON public.inventory_items;
DROP POLICY IF EXISTS "inv insert" ON public.inventory_items;
DROP POLICY IF EXISTS "inv update" ON public.inventory_items;
DROP POLICY IF EXISTS "inv delete" ON public.inventory_items;
CREATE POLICY "inv select" ON public.inventory_items FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "inv insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "inv update" ON public.inventory_items FOR UPDATE TO authenticated USING (organisation_id = current_org_id() AND can_write(current_org_id()));
CREATE POLICY "inv delete" ON public.inventory_items FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(current_org_id()));

-- ---------- work_orders ----------
DROP POLICY IF EXISTS "wo select" ON public.work_orders;
DROP POLICY IF EXISTS "wo insert" ON public.work_orders;
DROP POLICY IF EXISTS "wo update" ON public.work_orders;
DROP POLICY IF EXISTS "wo delete" ON public.work_orders;
CREATE POLICY "wo select" ON public.work_orders FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "wo insert" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (organisation_id = current_org_id() AND can_manage(current_org_id()));
-- assignee technician can update status; managers/owners full update
CREATE POLICY "wo update" ON public.work_orders FOR UPDATE TO authenticated
USING (organisation_id = current_org_id() AND (can_manage(current_org_id()) OR assignee_id = auth.uid()));
CREATE POLICY "wo delete" ON public.work_orders FOR DELETE TO authenticated USING (organisation_id = current_org_id() AND can_manage(current_org_id()));

-- ---------- checklist_completions: technician+ can write ----------
DROP POLICY IF EXISTS "cc select" ON public.checklist_completions;
DROP POLICY IF EXISTS "cc insert" ON public.checklist_completions;
DROP POLICY IF EXISTS "cc update" ON public.checklist_completions;
DROP POLICY IF EXISTS "cc delete" ON public.checklist_completions;
CREATE POLICY "cc select" ON public.checklist_completions FOR SELECT TO authenticated USING (machine_in_org(machine_id));
CREATE POLICY "cc insert" ON public.checklist_completions FOR INSERT TO authenticated WITH CHECK (machine_in_org(machine_id) AND can_write(current_org_id()));
CREATE POLICY "cc update" ON public.checklist_completions FOR UPDATE TO authenticated USING (machine_in_org(machine_id) AND (completed_by = auth.uid() OR can_manage(current_org_id())));
CREATE POLICY "cc delete" ON public.checklist_completions FOR DELETE TO authenticated USING (machine_in_org(machine_id) AND can_manage(current_org_id()));

-- ---------- profiles / organisations: tighten role audience ----------
DROP POLICY IF EXISTS "View profiles in own org" ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (organisation_id = current_org_id());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Members can view own org" ON public.organisations;
DROP POLICY IF EXISTS "Members can update own org" ON public.organisations;
CREATE POLICY "org select" ON public.organisations FOR SELECT TO authenticated USING (id = current_org_id());
CREATE POLICY "org update by managers" ON public.organisations FOR UPDATE TO authenticated USING (id = current_org_id() AND can_manage(id));
