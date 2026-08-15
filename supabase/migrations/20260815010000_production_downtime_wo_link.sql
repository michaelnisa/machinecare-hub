-- Links a production downtime event to the work order it spawned, so a
-- "breakdown" reason logged on the shop floor traces straight through to the
-- maintenance job that fixed it (Production.tsx auto-creates the work order
-- client-side when reason_code = 'breakdown').

ALTER TABLE public.production_downtime_events
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pde_work_order ON public.production_downtime_events(work_order_id);
