import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Mail,
  Clock,
  Trash2,
  Copy,
  Send,
  CheckCircle2,
  PhoneCall,
  Heart,
  Eye,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, initials } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type SafetyRole = "manager" | "officer" | "auditor" | "first_aid";

const SAFETY_ROLES: { id: SafetyRole; label: string; appRole: string; desc: string; icon: any }[] = [
  {
    id: "manager",
    label: "Safety Manager / EHS Lead",
    appRole: "manager",
    desc: "Full safety authority: approve RAMS, sign off Permits to Work (PTW), manage safety team and policy.",
    icon: ShieldCheck,
  },
  {
    id: "officer",
    label: "Safety Officer / Field Inspector",
    appRole: "engineer",
    desc: "Conduct daily site walks, audit contractor permits, log safety inspections, and review work suspensions.",
    icon: ShieldAlert,
  },
  {
    id: "first_aid",
    label: "First Aid & Emergency Officer",
    appRole: "technician",
    desc: "Log medical first-aid incidents, manage safety equipment/kits, on-duty emergency contact roster.",
    icon: Heart,
  },
  {
    id: "auditor",
    label: "Safety Compliance Auditor",
    appRole: "viewer",
    desc: "Read-only access to safety analytics, contractor HSE records, and inspection compliance reports.",
    icon: Eye,
  },
];

export default function SafetyTeam() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const load = async () => {
    if (!profile?.organisation_id) return;
    setLoading(true);

    // Fetch members in safety department
    let memberData: any[] = [];
    let inviteData: any[] = [];

    try {
      const [{ data: m, error: mErr }, { data: userRoles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, department, safety_role, phone, created_at")
          .eq("organisation_id", profile.organisation_id)
          .eq("department", "safety")
          .order("created_at"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organisation_id", profile.organisation_id),
      ]);

      if (mErr) {
        console.warn("SafetyTeam profiles query fallback:", mErr.message);
        const { data: fallbackM } = await supabase
          .from("profiles")
          .select("id, full_name, phone, created_at")
          .eq("organisation_id", profile.organisation_id)
          .order("created_at");
        memberData = fallbackM ?? [];
      } else {
        const roleMap = new Map((userRoles || []).map((r: any) => [r.user_id, r.role]));
        memberData = (m ?? []).map((member: any) => ({
          ...member,
          role: roleMap.get(member.id) || "officer",
        }));
      }
    } catch (e: any) {
      console.warn("SafetyTeam profiles query exception:", e);
    }

    try {
      const { data: inv, error: iErr } = await supabase
        .from("org_invites")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("department", "safety")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (iErr) {
        if (iErr.message?.toLowerCase().includes("does not exist")) {
          console.warn("org_invites department column missing:", iErr.message);
          inviteData = [];
        } else {
          toast.error(iErr.message);
        }
      } else {
        inviteData = inv ?? [];
      }
    } catch (e: any) {
      console.warn("SafetyTeam org_invites query exception:", e);
    }

    setMembers(memberData);
    setInvites(inviteData);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  const revokeInvite = async () => {
    if (!revokeId) return;
    const { error } = await supabase
      .from("org_invites")
      .update({ status: "revoked" })
      .eq("id", revokeId);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    setRevokeId(null);
    load();
  };

  const resendInviteEmail = async (inv: any) => {
    setResendingEmailId(inv.id);
    try {
      const appOrigin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: inv.email,
          role: inv.role,
          department: "safety",
          safety_role: inv.safety_role || "officer",
          origin: appOrigin,
        },
      });

      if (error) throw error;
      if (data?.emailSent) {
        toast.success(`Automated invitation email resent to ${inv.email}!`);
      } else if (data?.warning) {
        toast.info(data.warning);
      } else {
        toast.success(`Invite refreshed for ${inv.email}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resend email");
    } finally {
      setResendingEmailId(null);
      load();
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Safety Department Team
            </h1>
            <span className="rounded-full bg-[#00A651]/15 border border-[#00A651]/30 text-[#00A651] px-2.5 py-0.5 text-xs font-bold uppercase">
              EHS Division
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage Safety Department officers and assign granular permissions. Safety team members see only Safety &amp; People modules.
          </p>
        </div>

        <Button
          onClick={() => setInviteOpen(true)}
          className="bg-[#00A651] hover:bg-[#008f45] text-white gap-2 text-xs font-bold"
        >
          <UserPlus className="h-4 w-4" /> Invite Safety Officer
        </Button>
      </div>

      {/* Role Descriptions Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SAFETY_ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card p-4 space-y-1.5 shadow-sm hover:border-[#00A651]/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-[#00A651]">
                <Icon className="h-4 w-4" />
                <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                  {r.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Pending Safety Invites */}
      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-300/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <div className="border-b border-amber-300/30 px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Pending Safety Invites ({invites.length})
            </h2>
            <span className="text-[11px] text-muted-foreground">Automated email dispatched via Supabase</span>
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Safety Role</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const inviteLink = `${window.location.origin}/accept-invite/${inv.token}`;
                const isResending = resendingEmailId === inv.id;
                return (
                  <tr key={inv.id} className="border-t border-border/50">
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-[#00A651]" />
                        {inv.email}
                      </div>
                    </td>
                    <td className="px-5 py-3 capitalize">
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#00A651] border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold">
                        {inv.safety_role || "officer"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatDate(inv.expires_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResending}
                          onClick={() => resendInviteEmail(inv)}
                          className="h-7 text-xs gap-1 border-emerald-600/30 text-[#00A651]"
                        >
                          {isResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Resend Email
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            toast.success("Invite link copied");
                          }}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" /> Copy Link
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRevokeId(inv.id)}
                          className="h-7 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Safety Team Members Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-foreground">Active Safety Personnel</h2>
            <p className="text-xs text-muted-foreground">
              Personnel assigned to the Safety Department with isolated EHS views.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{members.length} members</span>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-2">
            <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No dedicated safety officers assigned yet.</p>
            <p className="text-xs max-w-sm mx-auto">
              Click &quot;Invite Safety Officer&quot; above to invite members to the Safety Department with email delivery.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3 font-medium">Officer</th>
                <th className="px-5 py-3 font-medium">Safety Function</th>
                <th className="px-5 py-3 font-medium">Access Scope</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[#00A651]/15 border border-[#00A651]/30 text-[#00A651] flex items-center justify-center font-bold text-xs">
                        {initials(m.full_name || "Safety Officer")}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {m.full_name || "Unnamed Officer"}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          Department: {m.department}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 capitalize">
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00A651] px-2.5 py-0.5 text-xs font-bold">
                      {m.safety_role || "officer"}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Safety-Only Isolated View
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {m.phone ? (
                      <div className="flex items-center gap-1">
                        <PhoneCall className="h-3 w-3 text-[#00A651]" /> {m.phone}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteSafetyMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={profile?.organisation_id}
        invitedBy={user?.id}
        onInvited={load}
      />

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke Safety Invite"
        description="Are you sure you want to cancel this invitation?"
        onConfirm={revokeInvite}
      />
    </div>
  );
}

function InviteSafetyMemberDialog({ open, onOpenChange, orgId, invitedBy, onInvited }: any) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [safetyRole, setSafetyRole] = useState<SafetyRole>("officer");
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [emailDispatched, setEmailDispatched] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setFullName("");
    setSafetyRole("officer");
    setCreatedLink(null);
    setEmailDispatched(false);
    setStatusMessage(null);
  };

  const handleInvite = async () => {
    if (!email.trim() || !email.includes("@")) {
      return toast.error("Enter a valid email address");
    }
    setSubmitting(true);
    setStatusMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const appOrigin = window.location.origin;

    const targetRole = SAFETY_ROLES.find((r) => r.id === safetyRole)?.appRole || "technician";

    try {
      const { data, error: fnError } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: normalizedEmail,
          full_name: fullName.trim() || undefined,
          role: targetRole,
          department: "safety",
          safety_role: safetyRole,
          origin: appOrigin,
        },
      });

      if (!fnError && data?.success) {
        const link = data.inviteLink || `${appOrigin}/accept-invite/${data.token}`;
        setCreatedLink(link);
        setEmailDispatched(Boolean(data.emailSent));
        setStatusMessage(data.message);
        if (data.emailSent) {
          toast.success(`Official invitation email sent to ${normalizedEmail}!`);
        } else {
          toast.info(data.warning || "Invite link created");
        }
      } else {
        throw new Error(fnError?.message || data?.error || "Edge function failed");
      }
    } catch (err: any) {
      console.warn("Edge function invite error, falling back to direct table insert:", err);
      // Fallback direct insert
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error: insErr } = await (supabase as any).from("org_invites").insert({
        organisation_id: orgId,
        email: normalizedEmail,
        role: targetRole,
        department: "safety",
        safety_role: safetyRole,
        invited_by: invitedBy,
        token,
      });

      if (insErr) {
        setSubmitting(false);
        return toast.error(insErr.message);
      }

      const fallbackLink = `${appOrigin}/accept-invite/${token}`;
      setCreatedLink(fallbackLink);
      setEmailDispatched(false);
      setStatusMessage("Invite link created! Share it directly with your safety team member.");
      toast.success("Safety invite created");
    }

    setSubmitting(false);
    onInvited();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#00A651]" />
            Invite Safety Team Member
          </DialogTitle>
        </DialogHeader>

        {createdLink ? (
          <div className="space-y-4 py-2">
            {emailDispatched ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#00A651] mt-0.5 shrink-0" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-bold text-sm">Official Email Dispatched!</p>
                  <p className="text-muted-foreground">
                    An activation email has been delivered to <strong>{email}</strong>. When they accept, they will have isolated Safety Department access.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-bold text-sm">Direct Activation Link Ready</p>
                  <p className="text-muted-foreground">{statusMessage}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Copy Activation Link (Instant Fallback)</Label>
              <div className="flex gap-2">
                <Input readOnly value={createdLink} className="text-xs font-mono bg-muted/40 h-9" />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(createdLink);
                    toast.success("Link copied to clipboard");
                  }}
                  className="bg-[#00A651] hover:bg-[#008f45] text-white h-9 px-3 gap-1"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                className="w-full text-xs"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Official Email Address *</Label>
              <Input
                type="email"
                placeholder="officer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name</Label>
              <Input
                placeholder="e.g. David Kasanga"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Safety Role &amp; Access Level *</Label>
              <div className="grid gap-2">
                {SAFETY_ROLES.map((r) => {
                  const Icon = r.icon;
                  const selected = safetyRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSafetyRole(r.id)}
                      className={`p-3 rounded-xl border text-left transition-colors flex items-start gap-3 ${
                        selected
                          ? "border-[#00A651] bg-emerald-500/10 text-foreground shadow-sm"
                          : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${selected ? "text-[#00A651]" : "text-muted-foreground"}`} />
                      <div>
                        <div className="text-xs font-bold text-foreground">{r.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground border border-border">
              <strong>Department Scope:</strong> This member will be assigned to <code>department = &apos;safety&apos;</code> and will only see Safety &amp; People tools upon logging in.
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleInvite}
                className="bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending Email...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Send Official Invite Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
