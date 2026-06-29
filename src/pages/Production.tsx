import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Target, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const SHIFTS = ["Day", "Evening", "Night"];

export default function Production() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: i }, { data: m }] = await Promise.all([
      supabase.from("production_kpis").select("*, machines(name)").order("record_date", { ascending: false }).limit(200),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setItems(i ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const stats = useMemo(() => {
    const target = items.reduce((s, x) => s + (x.target_units || 0), 0);
    const actual = items.reduce((s, x) => s + (x.actual_units || 0), 0);
    const scrap = items.reduce((s, x) => s + (x.scrap_units || 0), 0);
    const down = items.reduce((s, x) => s + (x.downtime_minutes || 0), 0);
    return { target, actual, scrap, down, att: target > 0 ? (actual / target * 100) : 0 };
  }, [items]);

  const trend = useMemo(() => {
    const byDate: Record<string, { date: string; target: number; actual: number }> = {};
    [...items].reverse().forEach((x) => {
      const d = x.record_date;
      if (!byDate[d]) byDate[d] = { date: d, target: 0, actual: 0 };
      byDate[d].target += x.target_units || 0;
      byDate[d].actual += x.actual_units || 0;
    });
    return Object.values(byDate).slice(-30);
  }, [items]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production KPIs</h1>
          <p className="text-sm text-muted-foreground">Daily target vs actual, scrap and downtime.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Log production</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Target units", value: stats.target },
          { label: "Actual units", value: stats.actual },
          { label: "Attainment", value: `${stats.att.toFixed(1)}%` },
          { label: "Scrap", value: stats.scrap },
          { label: "Downtime (min)", value: stats.down },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {trend.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Target vs actual</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="target" fill="hsl(var(--muted-foreground))" name="Target" />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title="No production logs" description="Log the first shift to see KPIs." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Shift</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Actual</th>
                <th className="px-5 py-3 font-medium">Scrap</th>
                <th className="px-5 py-3 font-medium">Downtime</th>
                <th className="px-5 py-3 font-medium">Attainment</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(x.record_date)}</td>
                  <td className="px-5 py-3">{x.shift ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">{x.product ?? "—"}</td>
                  <td className="px-5 py-3">{x.target_units}</td>
                  <td className="px-5 py-3">{x.actual_units}</td>
                  <td className="px-5 py-3">{x.scrap_units}</td>
                  <td className="px-5 py-3">{x.downtime_minutes}m</td>
                  <td className="px-5 py-3 font-medium">{Number(x.attainment_percent || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dlg open={open} setOpen={setOpen} machines={machines} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function Dlg({ open, setOpen, machines, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    record_date: new Date().toISOString().slice(0, 10),
    shift: "Day", machine_id: "", product: "", operator: "",
    target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
  });

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("production_kpis").insert({
      organisation_id: orgId,
      machine_id: f.machine_id || null,
      record_date: f.record_date,
      shift: f.shift || null,
      product: f.product || null,
      operator: f.operator || null,
      target_units: Number(f.target_units) || 0,
      actual_units: Number(f.actual_units) || 0,
      scrap_units: Number(f.scrap_units) || 0,
      downtime_minutes: Number(f.downtime_minutes) || 0,
      notes: f.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Log production</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Date</Label><Input type="date" value={f.record_date} onChange={(e) => setF({ ...f, record_date: e.target.value })} className="mt-1" /></div>
          <div><Label>Shift</Label>
            <select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>Machine</Label>
            <select value={f.machine_id} onChange={(e) => setF({ ...f, machine_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><Label>Product</Label><Input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} className="mt-1" /></div>
          <div><Label>Operator</Label><Input value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className="mt-1" /></div>
          <div><Label>Target units</Label><Input type="number" min={0} value={f.target_units} onChange={(e) => setF({ ...f, target_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Actual units</Label><Input type="number" min={0} value={f.actual_units} onChange={(e) => setF({ ...f, actual_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Scrap units</Label><Input type="number" min={0} value={f.scrap_units} onChange={(e) => setF({ ...f, scrap_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Downtime (min)</Label><Input type="number" min={0} value={f.downtime_minutes} onChange={(e) => setF({ ...f, downtime_minutes: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
