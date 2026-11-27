import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Loader2, CheckCircle2, ShieldCheck, UserCheck, AlertTriangle, ArrowRight, LogOut } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";
import { getInvitePreview, acceptOrgInvite, type InvitePreviewData } from "@/services/inviteService";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<InvitePreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Invalid invite link");
        setLoading(false);
        return;
      }

      const { data, error: previewErr } = await getInvitePreview(token);
      if (previewErr || !data) {
        setError("This invite link is no longer valid or has already been used.");
        setLoading(false);
        return;
      }

      setPreview(data);
      setLoading(false);
    })();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const result = await acceptOrgInvite(token);
      toast.success(
        `Welcome to ${result.organisation_name}! You have joined as ${result.role}.`
      );
      if (typeof window !== "undefined") {
        localStorage.removeItem("mc_admin_active_org_id");
      }
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Accept invite error:", err);
      toast.error(err.message || "Failed to accept invite. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut();
    navigate(`/login?next=/accept-invite/${token}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const emailMatches =
    user?.email &&
    preview?.email &&
    user.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-lg border border-primary/20 shadow-xs">
              {preview?.organisation_name ? (
                preview.organisation_name.trim().charAt(0).toUpperCase()
              ) : (
                <Wrench className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight block">
                {preview?.organisation_name || "MachineCare"}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Organisation Invitation
              </span>
            </div>
          </div>

          {error || !preview ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h1 className="text-xl font-bold">Invalid Invite</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {error ?? "This link is no longer valid. Please ask your administrator for a new one."}
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          ) : preview.expired ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <h1 className="text-xl font-bold">Invite Expired</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                This invitation has expired. Please ask your organisation administrator to send a new invite link.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">You're Invited</h1>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Join <span className="font-semibold text-foreground">{preview.organisation_name}</span> with assigned permissions:
                </p>
              </div>

              <div className="flex items-center gap-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground font-medium">Assigned Role</div>
                  <div className="font-semibold text-sm capitalize text-foreground flex items-center gap-2">
                    <span>{preview.role}</span>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 uppercase text-[10px]">
                      Verified Invite
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs space-y-1">
                <div className="text-muted-foreground font-medium">Invited Email Address</div>
                <div className="font-semibold text-sm text-foreground">{preview.email}</div>
              </div>

              {/* Logged in state */}
              {user ? (
                <div className="space-y-3 pt-2">
                  {emailMatches ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Signed in as <strong className="font-semibold">{user.email}</strong>. Ready to join.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div>
                          Invite was sent to <strong className="font-semibold">{preview.email}</strong>, but you are logged in as <strong className="font-semibold">{user.email}</strong>.
                        </div>
                        <button
                          type="button"
                          onClick={handleSwitchAccount}
                          className="font-medium underline hover:text-amber-900 cursor-pointer block mt-1"
                        >
                          Sign out & login as {preview.email}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleAcceptInvite}
                    disabled={accepting}
                    className="w-full gap-2 text-sm font-semibold shadow-md cursor-pointer"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining {preview.organisation_name}...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Accept Invite & Join {preview.organisation_name}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="h-3 w-3" /> Switch account
                    </button>
                    <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                      Go to dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                /* Logged out state */
                <div className="space-y-2.5 pt-2">
                  <Button asChild className="w-full font-semibold shadow-md" style={{ background: "var(--gradient-primary)" }}>
                    <Link to={`/signup?invite=${token}&email=${encodeURIComponent(preview.email)}`}>
                      Create Account & Join
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full font-medium">
                    <Link to={`/login?next=/accept-invite/${token}`}>
                      I already have an account
                    </Link>
                  </Button>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    If you have an existing account, click "I already have an account" to sign in and join directly with your assigned role.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
