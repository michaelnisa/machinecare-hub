import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Gauge, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function OEE() {
  const { profile, user } = useAuth();
  const { isManager } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("oee_records").select("*, machines(name)").order("record_date", { ascending: false }).limit(500),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setRecords(r ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const filtered = useMemo(() => {
    if (machineFilter === "all") return records;
    return records.filter((r) => r.machine_id === machineFilter);
  }, [records, machineFilter]);

  const chartData = useMemo(() => {
    return [...filtered].reverse().slice(-30).map((r) => ({
      date: r.record_date,
      OEE: Number(r.availability) * Number(r.performance) * Number(r.quality) / 10000,
      Availability: Number(r.availability),
      Performance: Number(r.performance),
      Quality: Number(r.quality),
    }));
  }, [filtered]);

  const avg = useMemo(() => {
    if (filtered.length === 0) return null;
    const sum = filtered.reduce((acc, r) => {
      const oee = Number(r.availability) * Number(r.performance) * Number(r.quality) / 10000;
      return { a: acc.a + Number(r.availability), p: acc.p + Number(r.performance), q: acc.q + Number(r.quality), o: acc.o + oee };
    }, { a: 0, p: 0, q: 0, o: 0 });
    const n = filtered.length;
    return { a: sum.a / n, p: sum.p / n, q: sum.q / n, o: sum.o / n };
  }, [filtered]);

  const handleDelete = async () => {
    if (!confirm) return;
    const { error } = await supabase.from("oee_records").delete().eq("id", confirm);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirm(null);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overall Equipment Effectiveness</h1>
          <p className="text-sm text-muted-foreground">Track availability, performance and quality per machine.</p>
        </div>
        <div className="flex gap-2">
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add OEE record
          </Button>
        </div>
      </div>

      {avg && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "OEE", value: avg.o },
            { label: "Availability", value: avg.a },
            { label: "Performance", value: avg.p },
            { label: "Quality", value: avg.q },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold">{s.value.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Last 30 records</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="OEE" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Availability" stroke="#10b981" dot={false} />
                <Line type="monotone" dataKey="Performance" stroke="#f59e0b" dot={false} />
                <Line type="monotone" dataKey="Quality" stroke="#6366f1" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Gauge className="h-5 w-5" />} title="No OEE records yet" description="Add a record to start tracking equipment effectiveness." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Avail.</th>
                <th className="px-5 py-3 font-medium">Perf.</th>
                <th className="px-5 py-3 font-medium">Qual.</th>
                <th className="px-5 py-3 font-medium">OEE</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const oee = Number(r.availability) * Number(r.performance) * Number(r.quality) / 10000;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-5 py-3">{formatDate(r.record_date)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.machines?.name ?? "—"}</td>
                    <td className="px-5 py-3">{Number(r.availability).toFixed(1)}%</td>
                    <td className="px-5 py-3">{Number(r.performance).toFixed(1)}%</td>
                    <td className="px-5 py-3">{Number(r.quality).toFixed(1)}%</td>
                    <td className="px-5 py-3 font-semibold">{oee.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right">
                      {isManager && (
                        <Button variant="ghost" size="icon" onClick={() => setConfirm(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OEEDialog open={open} onOpenChange={setOpen} machines={machines} onSaved={load} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this record?" description="This action cannot be undone."
        onConfirm={async () => { await handleDelete(); }} />
    </div>
  );
}

function OEEDialog({ open, onOpenChange, machines, onSaved }: any) {
  const { profile, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) setForm({
      machine_id: "",
      record_date: new Date().toISOString().slice(0, 10),
      planned_minutes: 480,
      downtime_minutes: 0,
      units_produced: 0,
      units_good: 0,
      ideal_cycle_seconds: 0,
      notes: "",
    });
  }, [open]);

  const preview = useMemo(() => {
    const pm = Number(form.planned_minutes) || 0;
    const dt = Number(form.downtime_minutes) || 0;
    const up = Number(form.units_produced) || 0;
    const ug = Number(form.units_good) || 0;
    const ic = Number(form.ideal_cycle_seconds) || 0;
    const runtime = Math.max(0, pm - dt);
    const a = pm > 0 ? Math.min(100, (runtime / pm) * 100) : 0;
    const p = runtime > 0 && ic > 0 ? Math.min(100, ((ic * up) / (runtime * 60)) * 100) : 0;
    const q = up > 0 ? Math.min(100, (ug / up) * 100) : 0;
    return { a, p, q, oee: (a * p * q) / 10000 };
  }, [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.machine_id) return toast.error("Pick a machine");
    if (!form.planned_minutes || Number(form.planned_minutes) <= 0) return toast.error("Planned minutes must be > 0");
    setSubmitting(true);
    const { error } = await supabase.from("oee_records").insert({
      organisation_id: profile.organisation_id,
      machine_id: form.machine_id,
      record_date: form.record_date,
      planned_minutes: Number(form.planned_minutes),
      downtime_minutes: Number(form.downtime_minutes) || 0,
      units_produced: Number(form.units_produced) || 0,
      units_good: Number(form.units_good) || 0,
      ideal_cycle_seconds: Number(form.ideal_cycle_seconds) || 0,
      notes: form.notes || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add OEE record</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Machine *</Label>
              <select value={form.machine_id ?? ""} onChange={(e) => setForm({ ...form, machine_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select machine</option>
                {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.record_date ?? ""} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Planned minutes *</Label>
              <Input type="number" min="0" value={form.planned_minutes ?? ""} onChange={(e) => setForm({ ...form, planned_minutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Downtime minutes</Label>
              <Input type="number" min="0" value={form.downtime_minutes ?? ""} onChange={(e) => setForm({ ...form, downtime_minutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Units produced</Label>
              <Input type="number" min="0" value={form.units_produced ?? ""} onChange={(e) => setForm({ ...form, units_produced: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Good units</Label>
              <Input type="number" min="0" value={form.units_good ?? ""} onChange={(e) => setForm({ ...form, units_good: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ideal cycle time (seconds per unit)</Label>
              <Input type="number" min="0" step="0.01" value={form.ideal_cycle_seconds ?? ""} onChange={(e) => setForm({ ...form, ideal_cycle_seconds: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
            <div className="grid grid-cols-4 gap-2">
              <div><div className="text-xs text-muted-foreground">Availability</div><div className="font-semibold">{preview.a.toFixed(1)}%</div></div>
              <div><div className="text-xs text-muted-foreground">Performance</div><div className="font-semibold">{preview.p.toFixed(1)}%</div></div>
              <div><div className="text-xs text-muted-foreground">Quality</div><div className="font-semibold">{preview.q.toFixed(1)}%</div></div>
              <div><div className="text-xs text-muted-foreground">OEE</div><div className="font-semibold text-primary">{preview.oee.toFixed(1)}%</div></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
