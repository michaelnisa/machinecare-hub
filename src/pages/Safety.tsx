import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ShieldAlert, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

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

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: i }, { data: m }] = await Promise.all([
      supabase.from("safety_incidents").select("*, machines(name)").order("occurred_at", { ascending: false }),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setItems(i ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Safety & incidents</h1>
          <p className="text-sm text-muted-foreground">Report accidents, near-misses and hazards.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Report incident</Button>
      </div>

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
