import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { CheckCircle2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Quality() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: i }, { data: m }] = await Promise.all([
      supabase.from("quality_reports").select("*, machines(name)").order("report_date", { ascending: false }).limit(200),
      supabase.from("machines").select("id, name").order("name"),
    ]);
    setItems(i ?? []);
    setMachines(m ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const stats = useMemo(() => {
    const insp = items.reduce((s, x) => s + (x.units_inspected || 0), 0);
    const def = items.reduce((s, x) => s + (x.units_defective || 0), 0);
    const scrap = items.reduce((s, x) => s + (x.units_scrap || 0), 0);
    const rework = items.reduce((s, x) => s + (x.units_rework || 0), 0);
    return { insp, def, scrap, rework, yield: insp > 0 ? ((insp - def) / insp * 100) : 0 };
  }, [items]);

  const trend = useMemo(() => {
    const byDate: Record<string, { date: string; insp: number; def: number }> = {};
    [...items].reverse().forEach((x) => {
      const d = x.report_date;
      if (!byDate[d]) byDate[d] = { date: d, insp: 0, def: 0 };
      byDate[d].insp += x.units_inspected || 0;
      byDate[d].def += x.units_defective || 0;
    });
    return Object.values(byDate).map((r) => ({ date: r.date, yield: r.insp > 0 ? Number(((r.insp - r.def) / r.insp * 100).toFixed(1)) : 0 }));
  }, [items]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quality reports</h1>
          <p className="text-sm text-muted-foreground">Track inspections, defects, rework and scrap.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New report</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Inspected", value: stats.insp },
          { label: "Defective", value: stats.def },
          { label: "Rework", value: stats.rework },
          { label: "Scrap", value: stats.scrap },
          { label: "First-pass yield", value: `${stats.yield.toFixed(1)}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {trend.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Yield trend</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="yield" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No quality reports yet" description="Log your first inspection." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Machine</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Inspected</th>
                <th className="px-5 py-3 font-medium">Defective</th>
                <th className="px-5 py-3 font-medium">Rework</th>
                <th className="px-5 py-3 font-medium">Scrap</th>
                <th className="px-5 py-3 font-medium">Yield</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(x.report_date)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.machines?.name ?? "—"}</td>
                  <td className="px-5 py-3">{x.product ?? "—"}</td>
                  <td className="px-5 py-3">{x.units_inspected}</td>
                  <td className="px-5 py-3">{x.units_defective}</td>
                  <td className="px-5 py-3">{x.units_rework}</td>
                  <td className="px-5 py-3">{x.units_scrap}</td>
                  <td className="px-5 py-3 font-medium">{Number(x.yield_percent || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QualityDialog open={open} setOpen={setOpen} machines={machines} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function QualityDialog({ open, setOpen, machines, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    report_date: new Date().toISOString().slice(0, 10),
    machine_id: "", product: "", inspector: "",
    units_inspected: 0, units_defective: 0, units_rework: 0, units_scrap: 0,
    defect_category: "", root_cause: "", corrective_action: "", notes: "",
  });

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("quality_reports").insert({
      organisation_id: orgId,
      machine_id: f.machine_id || null,
      report_date: f.report_date,
      product: f.product || null,
      inspector: f.inspector || null,
      units_inspected: Number(f.units_inspected) || 0,
      units_defective: Number(f.units_defective) || 0,
      units_rework: Number(f.units_rework) || 0,
      units_scrap: Number(f.units_scrap) || 0,
      defect_category: f.defect_category || null,
      root_cause: f.root_cause || null,
      corrective_action: f.corrective_action || null,
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
        <DialogHeader><DialogTitle>New quality report</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Date</Label><Input type="date" value={f.report_date} onChange={(e) => setF({ ...f, report_date: e.target.value })} className="mt-1" /></div>
          <div><Label>Machine</Label>
            <select value={f.machine_id} onChange={(e) => setF({ ...f, machine_id: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><Label>Product</Label><Input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} className="mt-1" /></div>
          <div><Label>Inspector</Label><Input value={f.inspector} onChange={(e) => setF({ ...f, inspector: e.target.value })} className="mt-1" /></div>
          <div><Label>Units inspected</Label><Input type="number" min={0} value={f.units_inspected} onChange={(e) => setF({ ...f, units_inspected: e.target.value })} className="mt-1" /></div>
          <div><Label>Units defective</Label><Input type="number" min={0} value={f.units_defective} onChange={(e) => setF({ ...f, units_defective: e.target.value })} className="mt-1" /></div>
          <div><Label>Units rework</Label><Input type="number" min={0} value={f.units_rework} onChange={(e) => setF({ ...f, units_rework: e.target.value })} className="mt-1" /></div>
          <div><Label>Units scrap</Label><Input type="number" min={0} value={f.units_scrap} onChange={(e) => setF({ ...f, units_scrap: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Defect category</Label><Input value={f.defect_category} onChange={(e) => setF({ ...f, defect_category: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Root cause</Label><Textarea rows={2} value={f.root_cause} onChange={(e) => setF({ ...f, root_cause: e.target.value })} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label>Corrective action</Label><Textarea rows={2} value={f.corrective_action} onChange={(e) => setF({ ...f, corrective_action: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
