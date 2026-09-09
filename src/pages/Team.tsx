import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, type Role } from "@/hooks/useUserRole";
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
import { PageLoader } from "@/components/PageLoader";
import {
  UserPlus,
  Loader2,
  Shield,
  Trash2,
  Copy,
  Mail,
  Clock,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, initials } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ROLES: Role[] = ["owner", "manager", "engineer", "technician", "viewer"];

const ROLE_DESC: Record<Role, string> = {
  owner: "Full access incl. billing & member management.",
  manager: "Manage machines, work orders, inventory, and team.",
  engineer: "Author & approve checklist templates; manage maintenance plans.",
  technician: "Log services, fuel, complete work orders.",
  viewer: "Read-only access to fleet data.",
};

export default function Team() {
  const { profile } = useAuth();
  const { isManager, isOwner } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, Role[]>>({});
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: m }, { data: r }, { data: inv }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, department, created_at")
        .eq("organisation_id", profile.organisation_id)
        .order("created_at"),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organisation_id", profile.organisation_id),
      supabase
        .from("org_invites")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setMembers(m ?? []);
    const byUser: Record<string, Role[]> = {};
    (r ?? []).forEach((row: any) => {
      (byUser[row.user_id] ||= []).push(row.role as Role);
    });
    setRoles(byUser);
    setInvites(inv ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [profile]);

  const updateRole = async (userId: string, newRole: Role) => {
    if (!profile) return;
    const { error } = await supabase.rpc("set_user_role", {
      _user_id: userId,
      _org_id: profile.organisation_id,
      _role: newRole,
    });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

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
          origin: appOrigin,
        },
      });

      if (error) throw error;
      if (data?.emailSent) {
        toast.success(`Automated invitation email sent to ${inv.email}!`);
      } else if (data?.warning) {
        toast.info(data.warning);
      } else {
        toast.success(`Invite refreshed for ${inv.email}`);
      }
    } catch (err: any) {
      console.warn("Resend email failed:", err);
      toast.error(err.message || "Failed to trigger email invite");
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Team & roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Invite mechanics, managers, and viewers to your organisation.
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite member
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-semibold capitalize">{r}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESC[r]}</p>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="font-semibold">Pending invites</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Actions</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const link = `${window.location.origin}/accept-invite/${inv.token}`;
                const expired = new Date(inv.expires_at) < new Date();
                const isResending = resendingEmailId === inv.id;
                return (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <Mail className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                      {inv.email}
                    </td>
                    <td className="px-5 py-3 capitalize">{inv.role}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {expired ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        formatDate(inv.expires_at)
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isResending || expired}
                          onClick={() => resendInviteEmail(inv)}
                          title="Trigger automated invitation email"
                        >
                          {isResending ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3.5 w-3.5 text-primary" />
                          )}
                          Resend email
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            toast.success("Invite link copied");
                          }}
                          title="Copy direct invite link"
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                        </Button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevokeId(inv.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold">Members</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const userRoles = roles[m.id] ?? [];
              const primary = (userRoles[0] ?? "viewer") as Role;
              const canEdit =
                isManager &&
                m.id !== profile?.id &&
                (isOwner || primary !== "owner");
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {initials(m.full_name)}
                      </div>
                      <span className="font-medium">{m.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="capitalize inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted/60 text-foreground border border-border">
                      {m.department || "Operations"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {canEdit ? (
                      <select
                        value={primary}
                        onChange={(e) =>
                          updateRole(m.id, e.target.value as Role)
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize">{primary}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs font-mono">
                    {m.phone || "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={load}
      />
      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke this invite?"
        description="The invite link will stop working immediately."
        onConfirm={async () => {
          await revokeInvite();
        }}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("technician");
  const [department, setDepartment] = useState("maintenance");
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [emailDispatched, setEmailDispatched] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setRole("technician");
    setDepartment("maintenance");
    setCreatedLink(null);
    setEmailDispatched(false);
    setStatusMessage(null);
  };

  const create = async () => {
    if (!profile) return;
    if (!email.trim() || !email.includes("@"))
      return toast.error("Enter a valid email");
    setSubmitting(true);
    setStatusMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const appOrigin = window.location.origin;
    let finalLink = "";
    let dispatched = false;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: normalizedEmail,
          role,
          department,
          origin: appOrigin,
        },
      });

      if (!fnError && data?.success) {
        finalLink = data.inviteLink || `${appOrigin}/accept-invite/${data.token}`;
        dispatched = Boolean(data.emailSent);
        setEmailDispatched(dispatched);
        setStatusMessage(data.message || (dispatched ? `Invite email sent to ${normalizedEmail}` : null));
        if (dispatched) {
          toast.success(`Automated invitation email sent to ${normalizedEmail}!`);
        } else if (data.warning) {
          toast.info(data.warning);
        }
      } else {
        throw new Error(fnError?.message || data?.error || "Edge function invocation error");
      }
    } catch (e: any) {
      console.warn("Fallback to direct org_invites table insert:", e);
      const insertObj: any = {
        organisation_id: profile.organisation_id,
        email: normalizedEmail,
        role,
        department,
        invited_by: profile.id,
      };
      let { data, error } = await supabase
        .from("org_invites")
        .insert(insertObj)
        .select("token")
        .single();

      if (error && error.message?.toLowerCase().includes("department")) {
        delete insertObj.department;
        const res2 = await supabase
          .from("org_invites")
          .insert(insertObj)
          .select("token")
          .single();
        data = res2.data;
        error = res2.error;
      }

      if (error) {
        setSubmitting(false);
        return toast.error(error.message);
      }
      finalLink = `${appOrigin}/accept-invite/${data.token}`;
      setEmailDispatched(false);
      setStatusMessage("Invite link created! Share the link below directly with your team member.");
      toast.success("Invite link generated");
    }

    setSubmitting(false);
    setCreatedLink(finalLink);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
        </DialogHeader>
        {createdLink ? (
          <div className="space-y-4">
            {emailDispatched ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold">Automated Email Dispatched</p>
                  <p className="text-xs text-muted-foreground dark:text-emerald-300/80">
                    Supabase Auth sent an official invite email directly to{" "}
                    <span className="font-medium text-foreground">{email}</span> with their activation link.
                  </p>
                </div>
              </div>
            ) : statusMessage ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold">Invite Ready</p>
                  <p className="text-xs text-muted-foreground dark:text-amber-300/80">
                    {statusMessage}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                You can also copy the direct invitation link below to share manually via WhatsApp, Slack, or SMS:
              </p>
              <div className="flex gap-2">
                <Input value={createdLink} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(createdLink);
                    toast.success("Invite link copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite_email">Email address</Label>
              <Input
                id="invite_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite_role">Role</Label>
              <select
                id="invite_role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ROLES.filter((r) => r !== "owner").map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{ROLE_DESC[role]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite_department">Department</Label>
              <select
                id="invite_department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="maintenance">Maintenance & Engineering</option>
                <option value="safety">Safety & EHS</option>
                <option value="production">Production & Operations</option>
                <option value="management">Management & Leadership</option>
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          {createdLink ? (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send invite
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
