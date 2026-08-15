-- Work order closure approval.
--
-- Today any writer can close a work order outright. This adds a mandatory
-- sign-off step: a work order cannot move to 'closed' unless an engineer or
-- a supervisor (manager/owner) has approved a closure request for it.
-- Mirrors the Permit to Work pattern in 20260814020000_safety_department_and_ptw.sql
-- (wo_safety_approvals + block_wo_start_pending_ptw), but gates the opposite
-- end of the lifecycle.

CREATE OR REPLACE FUNCTION public.can_close_wo(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_manage(_org) OR public.has_role(auth.uid(), _org, 'engineer')
$$;

REVOKE EXECUTE ON FUNCTION public.can_close_wo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_close_wo(uuid) TO authenticated;

CREATE TABLE public.wo_close_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wo_close_approvals TO authenticated;
GRANT ALL ON public.wo_close_approvals TO service_role;
ALTER TABLE public.wo_close_approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_wo_close_approvals_wo ON public.wo_close_approvals(work_order_id, status);

CREATE POLICY "wca select" ON public.wo_close_approvals FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "wca insert" ON public.wo_close_approvals FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "wca update" ON public.wo_close_approvals FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_close_wo(organisation_id));
CREATE POLICY "wca delete" ON public.wo_close_approvals FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_manage(organisation_id));

-- Block closing a work order unless it has an approved closure request. Like
-- block_wo_start_pending_ptw, this lives on work_orders itself (not inside
-- transition_wo) so it also covers the direct .update({status}) call sites
-- in MobileMachine.tsx and Vendors.tsx.
CREATE OR REPLACE FUNCTION public.block_wo_close_without_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wo_close_approvals
      WHERE work_order_id = NEW.id AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'This work order needs closure approval from an engineer or supervisor before it can be closed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_wo_close_without_approval
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.block_wo_close_without_approval();
