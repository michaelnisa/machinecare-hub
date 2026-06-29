-- Add creator/owner field to machine_checklist_items (creator-locked PM templates)
-- created_by already exists on machine_checklist_items.

-- Tighten RLS so only the creator can edit/delete; everyone in the org can still view + complete.
DROP POLICY IF EXISTS "ci update" ON public.machine_checklist_items;
DROP POLICY IF EXISTS "ci delete" ON public.machine_checklist_items;
DROP POLICY IF EXISTS "ci insert" ON public.machine_checklist_items;

-- Insert: any org member can create, but they MUST set themselves as creator
CREATE POLICY "ci insert by org member as self"
ON public.machine_checklist_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.machine_in_org(machine_id)
  AND created_by = auth.uid()
);

-- Update: only the original creator
CREATE POLICY "ci update only creator"
ON public.machine_checklist_items
FOR UPDATE
TO authenticated
USING (
  public.machine_in_org(machine_id)
  AND created_by = auth.uid()
);

-- Delete: only the original creator
CREATE POLICY "ci delete only creator"
ON public.machine_checklist_items
FOR DELETE
TO authenticated
USING (
  public.machine_in_org(machine_id)
  AND created_by = auth.uid()
);

-- Per-machine PM parts list (creator-locked).
CREATE TABLE IF NOT EXISTS public.machine_pm_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL,
  checklist_item_id UUID,
  part_name TEXT NOT NULL,
  part_number TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_pm_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm parts select org"
ON public.machine_pm_parts
FOR SELECT
TO authenticated
USING (public.machine_in_org(machine_id));

CREATE POLICY "pm parts insert as self"
ON public.machine_pm_parts
FOR INSERT
TO authenticated
WITH CHECK (public.machine_in_org(machine_id) AND created_by = auth.uid());

CREATE POLICY "pm parts update only creator"
ON public.machine_pm_parts
FOR UPDATE
TO authenticated
USING (public.machine_in_org(machine_id) AND created_by = auth.uid());

CREATE POLICY "pm parts delete only creator"
ON public.machine_pm_parts
FOR DELETE
TO authenticated
USING (public.machine_in_org(machine_id) AND created_by = auth.uid());

CREATE TRIGGER trg_pm_parts_touch
BEFORE UPDATE ON public.machine_pm_parts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_pm_parts_machine ON public.machine_pm_parts(machine_id);
CREATE INDEX IF NOT EXISTS idx_pm_parts_item ON public.machine_pm_parts(checklist_item_id);