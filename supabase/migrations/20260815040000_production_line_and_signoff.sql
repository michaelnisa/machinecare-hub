-- Two additions to production_kpis:
-- 1. production_line — a free-typed grouping tag (same denormalized style as
--    shift/product) so multi-machine lines can be rolled up and their
--    bottleneck machine identified, without introducing a new lines entity.
-- 2. log_status/approved_by/approved_at — a lightweight supervisor sign-off
--    so a shift's numbers aren't final until a manager/owner/engineer
--    approves them. Mirrors checklist_templates' status/approved_by/approved_at
--    approval columns (20260610155442_...sql).

ALTER TABLE public.production_kpis
  ADD COLUMN IF NOT EXISTS production_line text,
  ADD COLUMN IF NOT EXISTS log_status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.production_kpis
  DROP CONSTRAINT IF EXISTS production_kpis_log_status_check;
ALTER TABLE public.production_kpis
  ADD CONSTRAINT production_kpis_log_status_check CHECK (log_status IN ('submitted', 'approved'));

-- can_write() already covers owner/manager/engineer/technician, so the
-- existing "pk update" policy is enough to let the row be edited. Sign-off
-- specifically needs a narrower gate though (technicians can log production
-- but shouldn't be able to approve their own numbers), so block that one
-- transition in a trigger rather than relaxing/tightening the RLS UPDATE
-- policy — reuses can_close_wo (owner/manager/engineer), same audience as
-- work order closure approval.
CREATE OR REPLACE FUNCTION public.block_production_signoff()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.log_status = 'approved' AND OLD.log_status IS DISTINCT FROM 'approved' THEN
    IF NOT public.can_close_wo(NEW.organisation_id) THEN
      RAISE EXCEPTION 'Only an engineer or supervisor can approve a production log';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_production_signoff ON public.production_kpis;
CREATE TRIGGER trg_block_production_signoff
BEFORE UPDATE ON public.production_kpis
FOR EACH ROW EXECUTE FUNCTION public.block_production_signoff();
