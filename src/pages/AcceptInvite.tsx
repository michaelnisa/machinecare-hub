import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface InvitePreview {
  organisation_name: string;
  email: string;
  role: string;
  expired: boolean;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setError("Invalid invite link"); setLoading(false); return; }
      // Read invite by token if signed-in user's email matches; otherwise show generic prompt
      const { data, error } = await supabase
        .from("org_invites")
        .select("email, role, expires_at, status, organisations(name)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("This invite link is no longer valid.");
        setLoading(false);
        return;
      }
      setPreview({
        organisation_name: (data as any).organisations?.name ?? "an organisation",
        email: (data as any).email,
        role: (data as any).role,
        expired: new Date((data as any).expires_at) < new Date() || (data as any).status !== "pending",
      });
      setLoading(false);
    })();
  }, [token, user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <div className="w-full rounded-xl border border-border bg-card p-8">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">MachineCare</span>
          </div>

          {error || !preview ? (
            <>
              <h1 className="text-2xl font-bold">Invalid invite</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error ?? "This link is no longer valid. Please ask your administrator for a new one."}</p>
              <Button asChild className="mt-6 w-full"><Link to="/">Go home</Link></Button>
            </>
          ) : preview.expired ? (
            <>
              <h1 className="text-2xl font-bold">Invite expired</h1>
              <p className="mt-2 text-sm text-muted-foreground">This invite is no longer valid. Please ask your administrator to send a new one.</p>
              <Button asChild className="mt-6 w-full"><Link to="/">Go home</Link></Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">You're invited</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You've been invited to join <span className="font-medium text-foreground">{preview.organisation_name}</span> as a <span className="capitalize font-medium text-foreground">{preview.role}</span>.
              </p>
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Invite is for:</span> <span className="font-medium">{preview.email}</span>
              </div>
              <div className="mt-6 space-y-2">
                <Button asChild className="w-full" style={{ background: "var(--gradient-primary)" }}>
                  <Link to={`/signup?invite=${token}&email=${encodeURIComponent(preview.email)}`}>Create account & join</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/login?next=/accept-invite/${token}`}>I already have an account</Link>
                </Button>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Use the email address above when creating your account so we can match the invite.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
