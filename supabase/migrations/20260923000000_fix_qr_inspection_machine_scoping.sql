-- Bug: scanning a machine's QR code and tapping "Pre-Start Inspection"
-- (/m/:id/inspect) never found a checklist, for two compounding reasons:
--
-- 1. The "mark as the QR-scan inspection template" checkbox in
--    ChecklistTemplateDetail.tsx was gated behind `isFleet` (industry
--    profile === 'fleet_logistics'). A dairy/manufacturing/garage org has
--    no way to flag any template at all, so is_fleet_pre_start could never
--    be set — the UI fix for that gate ships alongside this migration.
-- 2. Even when a template was flagged, get_fleet_pre_start_template()
--    ignored the template's own machine_id / machine_category scoping —
--    it matched purely on organisation_id + is_fleet_pre_start + approved.
--    A template built "for this specific machine" via the template editor
--    was therefore not actually restricted to that machine (it would leak
--    to every other machine in the org), while a *different*, more
--    specific template for the same machine wouldn't be preferred over it
--    — there was no ranking, and if two approved flagged templates
--    existed, their items were concatenated together via the JOIN.
--
-- Fix: rank matches by specificity (exact machine_id > machine_category >
-- org-wide) and return exactly one template. Also tighten
-- can_submit_fleet_inspection so the anon INSERT check verifies the
-- submitted template is actually one that applies to that machine, not
-- just any org template with the flag set.

CREATE OR REPLACE FUNCTION public.get_fleet_pre_start_template(_machine_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_name text,
  template_version int,
  item_id uuid,
  item_text text,
  item_sort_order int,
  item_severity text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mach AS (
    SELECT id, organisation_id, category FROM public.machines WHERE id = _machine_id
  ), best AS (
    SELECT t.id, t.name, t.version
    FROM public.checklist_templates t
    JOIN mach ON t.organisation_id = mach.organisation_id
    WHERE t.is_fleet_pre_start = true
      AND t.status = 'approved'
      AND (t.machine_id = mach.id OR t.machine_id IS NULL)
      AND (t.machine_category IS NULL OR t.machine_category = mach.category)
    ORDER BY
      CASE
        WHEN t.machine_id = mach.id THEN 0
        WHEN t.machine_category IS NOT NULL THEN 1
        ELSE 2
      END,
      t.created_at DESC
    LIMIT 1
  )
  SELECT best.id, best.name, best.version, i.id, i.text, i.sort_order, i.severity
  FROM best
  JOIN public.checklist_template_items i ON i.template_id = best.id
  ORDER BY i.sort_order
$$;

GRANT EXECUTE ON FUNCTION public.get_fleet_pre_start_template(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_submit_fleet_inspection(_org_id uuid, _machine_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.checklist_templates t ON t.id = _template_id
    WHERE m.id = _machine_id
      AND m.organisation_id = _org_id
      AND t.organisation_id = _org_id
      AND t.is_fleet_pre_start = true
      AND t.status = 'approved'
      AND (t.machine_id = m.id OR t.machine_id IS NULL)
      AND (t.machine_category IS NULL OR t.machine_category = m.category)
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_submit_fleet_inspection(uuid, uuid, uuid) TO anon, authenticated;
