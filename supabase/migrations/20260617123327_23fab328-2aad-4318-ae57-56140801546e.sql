
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'none'
    CHECK (order_status IN ('none','requested','ordered','in_transit','received')),
  ADD COLUMN IF NOT EXISTS order_note text,
  ADD COLUMN IF NOT EXISTS ordered_at date,
  ADD COLUMN IF NOT EXISTS order_expected_at date,
  ADD COLUMN IF NOT EXISTS last_low_stock_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_inv_low_stock
  ON public.inventory_items (organisation_id)
  WHERE quantity <= reorder_level;
