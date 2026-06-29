import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "invalid" | "already" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.valid) setState("valid");
        else if (d?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error) setState("error");
    else if (data?.success) setState("done");
    else if (data?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Email preferences</h1>
        {state === "loading" && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {state === "valid" && (
          <>
            <p className="mb-6 text-sm text-muted-foreground">Click below to confirm and stop receiving emails from MachineCare.</p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm unsubscribe
            </Button>
          </>
        )}
        {state === "done" && (
          <div className="space-y-2">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">You've been unsubscribed.</p>
          </div>
        )}
        {state === "already" && (
          <div className="space-y-2">
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">This address is already unsubscribed.</p>
          </div>
        )}
        {(state === "invalid" || state === "error") && (
          <div className="space-y-2">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
          </div>
        )}
      </div>
    </div>
  );
}
