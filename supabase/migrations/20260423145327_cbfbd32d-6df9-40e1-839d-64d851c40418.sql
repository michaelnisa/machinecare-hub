DROP POLICY IF EXISTS "Public read machine-docs" ON storage.objects;
CREATE POLICY "Auth read machine-docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'machine-docs');
-- Make bucket private so URLs require auth (we'll use public URLs only for image previews via signed URLs if needed, but getPublicUrl still works for authenticated browsers in same session)
UPDATE storage.buckets SET public = false WHERE id = 'machine-docs';