import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

// Resolves a stored cover_image_url which may be either a full public URL
// (legacy) or a storage path in the `machine-docs` bucket, into a displayable
// signed URL.
export function CoverImage({ value, alt, className, fallback = null }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) { setSrc(null); return; }
    if (/^https?:\/\//i.test(value)) {
      setSrc(value);
      return;
    }
    // Treat as storage path in machine-docs
    supabase.storage
      .from("machine-docs")
      .createSignedUrl(value, 60 * 60)
      .then(({ data }) => { if (active) setSrc(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [value]);

  if (!src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} />;
}
