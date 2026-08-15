-- Inventory module Phase 3 (per Inventory_New.md): Machine ↔ Part
-- relationships, Critical Spares, and Consumption/Cost tracking.
--
-- Deliberately does NOT touch the existing machine_pm_parts table (free-text
-- parts tied to a specific PM checklist item, with its own creator-only edit
-- permission model) — that is a different concept (per-task requirement
-- list) from this: a general "this part fits/is used on this machine"
-- master relationship, which is what powers "machines using this part" and
-- "required spare parts" on the machine page, and Critical Spares filtering.
-- Consumption/cost tracking needs no new table — it's answered by the
-- existing stock_transactions ledger (already carries machine_id and
-- work_order_id from Phase 1).

CREATE TABLE public.machine_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_per_unit numeric NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_parts TO authenticated;
GRANT ALL ON public.machine_parts TO service_role;
ALTER TABLE public.machine_parts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_machine_parts_machine ON public.machine_parts(machine_id);
CREATE INDEX idx_machine_parts_item ON public.machine_parts(item_id);

CREATE POLICY "mp select" ON public.machine_parts FOR SELECT TO authenticated
  USING (organisation_id = current_org_id());
CREATE POLICY "mp insert" ON public.machine_parts FOR INSERT TO authenticated
  WITH CHECK (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "mp update" ON public.machine_parts FOR UPDATE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
CREATE POLICY "mp delete" ON public.machine_parts FOR DELETE TO authenticated
  USING (organisation_id = current_org_id() AND can_write(organisation_id));
