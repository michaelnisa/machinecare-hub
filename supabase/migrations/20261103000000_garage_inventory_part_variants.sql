-- Add vehicle_model and parent_id to inventory_items for multi-model / variant spare parts
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_vehicle_model ON public.inventory_items(organisation_id, vehicle_model);
CREATE INDEX IF NOT EXISTS idx_inventory_items_parent_id ON public.inventory_items(organisation_id, parent_id);
