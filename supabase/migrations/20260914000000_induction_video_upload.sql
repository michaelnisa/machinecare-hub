-- Allow real video file uploads into the induction-assets bucket (previously
-- only PDFs were uploaded there; video content was YouTube-URL-only).
-- Sets an explicit size cap and restricts MIME types so the bucket doesn't
-- silently accept arbitrary files.
UPDATE storage.buckets
SET file_size_limit = 209715200, -- 200MB
    allowed_mime_types = ARRAY['application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
WHERE id = 'induction-assets';
