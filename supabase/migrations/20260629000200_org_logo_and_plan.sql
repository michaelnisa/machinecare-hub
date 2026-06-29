-- ============================================================
-- Organisation logo + plan (lite / standard)
-- ============================================================

-- Logo URL stored after upload to org-logos bucket
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Plan controls which sidebar modules are visible
-- 'lite'     → Machines, Work Orders, Inventory, Fuel, Documents, Team, Settings
-- 'standard' → Everything (default)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'standard'
  CHECK (plan IN ('lite', 'standard'));

-- ── Storage bucket for organisation logos ─────────────────────
-- Public bucket: logos appear on printed documents and must load
-- without auth headers (html2canvas / PDF export).
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (logos are not sensitive)
CREATE POLICY "Public read org-logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'org-logos');

-- Only authenticated members of the org can upload/update/delete
-- their own logo (path must start with org_id/).
CREATE POLICY "Org upload org-logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
CREATE POLICY "Org update org-logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
CREATE POLICY "Org delete org-logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );
