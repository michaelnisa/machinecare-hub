import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ShieldAlert, Plus, Loader2, CheckCircle2, XCircle, ClipboardList, ListChecks, ClipboardCheck, GraduationCap, Tv } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Link } from "react-router-dom";
import { formatWoNumber } from "@/components/WorkOrderPreview";

const TYPES = ["near_miss", "accident", "hazard", "first_aid", "lost_time"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "investigating", "closed"];

const SEV_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};
const STAT_CLASS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  investigating: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
};

export default function Safety() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [pendingPtw, setPendingPtw] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [dash, setDash] = useState({
    pendingRiskAssessments: 0,
    activeLoto: 0,
    openCorrectiveActions: 0,
    overdueCorrectiveActions: 0,
    expiringInductions: 0,
  });

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString();
    const [{ data: i, error: e1 }, { data: m, error: e2 }, { data: ptw, error: e3 }, { count: raCount }, { count: lotoCount }, { data: ca }, { count: expCount }] = await Promise.all([
      supabase.from("safety_incidents").select("*, machines(name)").order("occurred_at", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
      (supabase as any)
        .from("wo_safety_approvals")
        .select("*, work_orders(id, title, wo_number, wo_year)")
        .eq("status", "pending")
        .order("requested_at", { ascending: true }),
      (supabase as any).from("risk_assessments").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
      (supabase as any).from("wo_loto_checklists").select("id", { count: "exact", head: true }).in("status", ["not_started", "in_progress"]),
      (supabase as any).from("corrective_actions").select("id, due_date, status").neq("status", "closed"),
      (supabase as any).from("induction_records").select("id", { count: "exact", head: true }).lte("expires_at", in30).gte("expires_at", today),
    ]);
    const err = e1 || e2 || e3;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    setMachines(m ?? []);
    setPendingPtw(ptw ?? []);
    const openCa = (ca ?? []).length;
    const overdueCa = (ca ?? []).filter((x: any) => x.due_date && x.due_date < today).length;
    setDash({
      pendingRiskAssessments: raCount ?? 0,
      activeLoto: lotoCount ?? 0,
      openCorrectiveActions: openCa,
      overdueCorrectiveActions: overdueCa,
      expiringInductions: expCount ?? 0,
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const reviewPtw = async (id: string, status: "approved" | "rejected") => {
    setReviewingId(id);
    const { error } = await (supabase as any)
      .from("wo_safety_approvals")
      .update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setReviewingId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Permit approved" : "Permit rejected");
    load();
  };

  const filtered = useMemo(() => filter === "all" ? items : items.filter((x) => x.status === filter), [items, filter]);

  const stats = useMemo(() => ({
    total: items.length,
    open: items.filter((x) => x.status === "open").length,
    critical: items.filter((x) => x.severity === "critical").length,
    lostTime: items.reduce((s, x) => s + Number(x.lost_time_hours || 0), 0),
  }), [items]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("safety_incidents").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety dashboard</h1>
          <p className="text-sm text-muted-foreground">Incidents, permits, risk assessments, LOTO and corrective actions in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/safety/live-tv">
            <Button variant="outline" className="gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400">
              <Tv className="h-4 w-4" /> Safety Live TV
            </Button>
          </Link>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Report incident</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Pending permits", value: pendingPtw.length, tone: pendingPtw.length > 0 ? "amber" : "green" },
          { label: "Risk assessments awaiting approval", value: dash.pendingRiskAssessments, tone: dash.pendingRiskAssessments > 0 ? "amber" : "green" },
          { label: "Active LOTO", value: dash.activeLoto, tone: dash.activeLoto > 0 ? "blue" : "green" },
          { label: "Open corrective actions", value: dash.openCorrectiveActions, tone: dash.overdueCorrectiveActions > 0 ? "red" : dash.openCorrectiveActions > 0 ? "amber" : "green" },
          { label: "Inductions expiring ≤30d", value: dash.expiringInductions, tone: dash.expiringInductions > 0 ? "amber" : "green" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone === "red" ? "text-red-600" : s.tone === "amber" ? "text-amber-600" : s.tone === "blue" ? "text-blue-600" : "text-emerald-600"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/safety/risk-assessments" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardList className="h-3.5 w-3.5" /> Risk assessments</Link>
        <Link to="/safety/inspections" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Safety inspections</Link>
        <Link to="/safety/corrective-actions" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ListChecks className="h-3.5 w-3.5" /> Corrective actions</Link>
        <Link to="/induction/dashboard" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><GraduationCap className="h-3.5 w-3.5" /> Induction</Link>
        <Link to="/safety/competency" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><GraduationCap className="h-3.5 w-3.5" /> Training &amp; competency</Link>
        <Link to="/safety/equipment" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Safety equipment</Link>
        <Link to="/safety/certificates" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Certificates</Link>
        <Link to="/safety/ppe" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> PPE</Link>
        <Link to="/safety/contractors" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Contractors</Link>
        <Link to="/safety/controlled-tools" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Controlled tools</Link>
        <Link to="/safety/documents" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Documents &amp; knowledge</Link>
        <Link to="/safety/rules" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/60"><ClipboardCheck className="h-3.5 w-3.5" /> Safety rules</Link>
      </div>

      {pendingPtw.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="mb-3 text-sm font-semibold text-amber-900">
            Pending Permits to Work ({pendingPtw.length})
          </div>
          <div className="space-y-2">
            {pendingPtw.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white p-3">
                <Link to={`/work-orders/${p.work_orders?.id}`} className="text-sm font-medium text-primary hover:underline">
                  {p.work_orders ? `${formatWoNumber(p.work_orders.wo_year, p.work_orders.wo_number)} — ${p.work_orders.title}` : "Work order"}
                </Link>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewPtw(p.id, "approved")} disabled={reviewingId === p.id} className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reviewPtw(p.id, "rejected")} disabled={reviewingId === p.id} className="gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Open", value: stats.open },
          { label: "Critical", value: stats.critical },
          { label: "Lost-time hrs", value: stats.lostTime.toFixed(1) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="No incidents" description="A safe shift is a good shift." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Severity</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(x.occurred_at)}</td>
                  <td className="px-5 py-3 capitalize">{x.incident_type?.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${SEV_CLASS[x.severity]}`}>{x.severity}</span></td>
                  <td className="px-5 py-3 max-w-md truncate">{x.description}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STAT_CLASS[x.status]}`}>{x.status}</span></td>
                  <td className="px-5 py-3 text-right">
                    {x.status !== "closed" && (
                      <select value={x.status} onChange={(e) => updateStatus(x.id, e.target.value)}
                        className="rounded border border-input bg-background px-2 py-1 text-xs">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReportDialog open={open} setOpen={setOpen} machines={machines} userId={user?.id} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function ReportDialog({ open, setOpen, machines, userId, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    incident_type: "near_miss",
    severity: "low",
    occurred_at: new Date().toISOString().slice(0, 16),
    location: "",
    persons_involved: "",
    description: "",
    immediate_action: "",
    corrective_action: "",
    machine_id: "",
    lost_time_hours: 0,
  });

  const submit = async () => {
    if (!form.description) return toast.error("Description required");
    setSaving(true);
    const { error } = await supabase.from("safety_incidents").insert({
      organisation_id: orgId,
      reported_by: userId,
      incident_type: form.incident_type,
      severity: form.severity,
      occurred_at: new Date(form.occurred_at).toISOString(),
      location: form.location || null,
      persons_involved: form.persons_involved || null,
      description: form.description,
      immediate_action: form.immediate_action || null,
      corrective_action: form.corrective_action || null,
      machine_id: form.machine_id || null,
      lost_time_hours: Number(form.lost_time_hours) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Incident reported");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Report incident</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Type</Label>
            <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Severity</Label>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {SEVERITIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Occurred at</Label>
            <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className="mt-1" />
          </div>
          <div><Label>Machine (optional)</Label>
            <select value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
          <div><Label>Persons involved</Label><Input value={form.persons_involved} onChange={(e) => setForm({ ...form, persons_involved: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Immediate action</Label><Textarea rows={2} value={form.immediate_action} onChange={(e) => setForm({ ...form, immediate_action: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Corrective action</Label><Textarea rows={2} value={form.corrective_action} onChange={(e) => setForm({ ...form, corrective_action: e.target.value })} className="mt-1" /></div>
          <div><Label>Lost time (hours)</Label><Input type="number" min={0} step={0.5} value={form.lost_time_hours} onChange={(e) => setForm({ ...form, lost_time_hours: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
