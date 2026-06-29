import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useServiceNotifications } from "@/hooks/useServiceNotifications";
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
  Bell,
  Plus,
  Loader2,
  Filter,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Clock,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "acknowledged", "converted", "closed"];

const SEVERITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  acknowledged: "bg-amber-100 text-amber-700",
  converted: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
};

type InboxTab = "issues" | "alerts";

export default function Notifications() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState<InboxTab>("issues");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  // Service schedule alerts (overdue / due-soon)
  const { items: alerts, loading: alertsLoading } = useServiceNotifications();

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: n }, { data: m }] = await Promise.all([
      supabase
        .from("maintenance_notifications")
        .select("*, machines(name)")
        .order("created_at", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setItems(n ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((o) => o.status === statusFilter);
  }, [items, statusFilter]);

  const acknowledge = async (id: string) => {
    const { error } = await supabase
      .from("maintenance_notifications")
      .update({
        status: "acknowledged",
        acknowledged_by: user?.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acknowledged");
    load();
  };

  const close = async (id: string) => {
    const { error } = await supabase
      .from("maintenance_notifications")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Closed");
    load();
  };

  const convertToWorkOrder = async (n: any) => {
    if (!profile || !n.machine_id)
      return toast.error("A machine is required to create a work order");
    const priority =
      n.severity === "critical"
        ? "urgent"
        : n.severity === "high"
          ? "high"
          : "normal";
    const { data: wo, error } = await supabase
      .from("work_orders")
      .insert({
        organisation_id: profile.organisation_id,
        machine_id: n.machine_id,
        title: n.title,
        description: n.description,
        priority,
        status: "open",
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await supabase
      .from("maintenance_notifications")
      .update({ status: "converted", work_order_id: wo.id })
      .eq("id", n.id);
    toast.success("Work order created", {
      action: { label: "View", onClick: () => navigate("/work-orders") },
    });
    load();
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase
      .from("maintenance_notifications")
      .delete()
      .eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading && alertsLoading) return <PageLoader />;

  const overdueAlerts = alerts.filter((a) => a.status === "overdue");
  const dueSoonAlerts = alerts.filter((a) => a.status === "due_soon");
  const openIssues = items.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            All maintenance alerts in one place.
          </p>
        </div>
        {tab === "issues" && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Raise issue
          </Button>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {(
          [
            { id: "issues", label: "Floor Issues", count: openIssues },
            { id: "alerts", label: "Service Alerts", count: alerts.length },
          ] as { id: InboxTab; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-foreground/20"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Floor Issues ── */}
      {tab === "issues" && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 bg-transparent text-sm focus:outline-none"
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="Nothing to report"
              description="Raise an issue to flag a maintenance problem from the floor."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Issue</th>
                    <th className="px-5 py-3 font-medium">Machine</th>
                    <th className="px-5 py-3 font-medium">Severity</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Raised</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="font-medium">{o.title}</div>
                        {o.description && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {o.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {o.machines?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_CLASS[o.severity]}`}
                        >
                          {o.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[o.status]}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right space-x-1">
                        {isManager && o.status === "open" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledge(o.id)}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Ack
                          </Button>
                        )}
                        {isManager &&
                          (o.status === "open" ||
                            o.status === "acknowledged") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => convertToWorkOrder(o)}
                            >
                              <ArrowRight className="mr-1 h-3.5 w-3.5" /> Work
                              order
                            </Button>
                          )}
                        {isManager && o.status !== "closed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => close(o.id)}
                          >
                            Close
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirm(o.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Service Alerts ── */}
      {tab === "alerts" && (
        <>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="All schedules on track"
              description="No machines are overdue or due soon."
            />
          ) : (
            <div className="space-y-3">
              {overdueAlerts.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-destructive/30 bg-card">
                  <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-5 py-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-semibold text-destructive">
                      {overdueAlerts.length} overdue
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {overdueAlerts.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-5 py-3">
                            <Link
                              to={`/machines/${a.machine_id}`}
                              className="font-medium hover:text-primary"
                            >
                              {a.machine_name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {a.schedule_name}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-xs text-destructive font-medium">
                              Was due {formatDate(a.next_due_date)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/machines/${a.machine_id}`}>
                                <Wrench className="mr-1 h-3.5 w-3.5" />
                                View
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {dueSoonAlerts.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-amber-200 bg-card">
                  <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700">
                      {dueSoonAlerts.length} due soon
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {dueSoonAlerts.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-5 py-3">
                            <Link
                              to={`/machines/${a.machine_id}`}
                              className="font-medium hover:text-primary"
                            >
                              {a.machine_name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {a.schedule_name}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-xs text-amber-600 font-medium">
                              Due {formatDate(a.next_due_date)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/machines/${a.machine_id}`}>
                                <Wrench className="mr-1 h-3.5 w-3.5" />
                                View
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <NotificationDialog
        open={open}
        onOpenChange={setOpen}
        machines={machines}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this notification?"
        description="This action cannot be undone."
        onConfirm={async () => {
          await handleDelete();
        }}
      />
    </div>
  );
}

function NotificationDialog({ open, onOpenChange, machines, onSaved }: any) {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    machine_id: "",
    severity: "medium",
  });

  useEffect(() => {
    if (open)
      setForm({
        title: "",
        description: "",
        machine_id: "",
        severity: "medium",
      });
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.title?.trim()) return toast.error("Title is required");
    setSubmitting(true);
    const { error } = await supabase.from("maintenance_notifications").insert({
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id || null,
      title: form.title.trim(),
      description: form.description || null,
      severity: form.severity,
      reported_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Notification raised");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Raise a maintenance notification</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Machine</Label>
              <select
                value={form.machine_id}
                onChange={(e) =>
                  setForm({ ...form, machine_id: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— None —</option>
                {machines.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              maxLength={2000}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              Raise
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
