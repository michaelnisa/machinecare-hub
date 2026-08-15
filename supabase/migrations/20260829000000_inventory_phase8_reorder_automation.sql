-- Inventory module Phase 8 (per Inventory_New.md sections 21/45/48):
-- Automatic reorder notifications. Follows the same pattern already used
-- for production threshold alerts (20260815030000_production_org_settings.sql)
-- and calibration-expiry blocking (phase 5) rather than introducing a
-- separate generic "rule" table: each item's own reorder_level/criticality
-- (Phase 1) is the configurable threshold, so no new settings surface is
-- needed for this to be configurable per item/per org.

CREATE OR REPLACE FUNCTION public.check_item_reorder_threshold()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  -- Crossed to zero/negative: out of stock.
  IF NEW.quantity <= 0 AND OLD.quantity > 0 THEN
    INSERT INTO public.maintenance_notifications (organisation_id, title, description, severity)
    VALUES (
      NEW.organisation_id,
      (CASE WHEN NEW.criticality = 'critical' THEN 'Critical spare out of stock — ' ELSE 'Out of stock — ' END) || NEW.name,
      NEW.name || ' has reached zero stock.' || (CASE WHEN NEW.criticality = 'critical' THEN ' This is a critical spare part — maintenance work needing it may be blocked.' ELSE '' END),
      CASE WHEN NEW.criticality = 'critical' THEN 'critical' ELSE 'high' END
    );
  -- Crossed at/under the reorder point, but still on hand.
  ELSIF NEW.quantity > 0 AND NEW.quantity <= COALESCE(NEW.reorder_level, 0) AND OLD.quantity > COALESCE(NEW.reorder_level, 0) THEN
    INSERT INTO public.maintenance_notifications (organisation_id, title, description, severity)
    VALUES (
      NEW.organisation_id,
      'Low stock — ' || NEW.name,
      NEW.name || ' is at ' || NEW.quantity || ' ' || NEW.unit || ', at or below its reorder point (' || COALESCE(NEW.reorder_level, 0) || ').',
      'medium'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_item_reorder_threshold ON public.inventory_items;
CREATE TRIGGER trg_check_item_reorder_threshold
AFTER UPDATE OF quantity ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.check_item_reorder_threshold();
