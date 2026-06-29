import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Zap, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const TYPES = [
  { v: "electricity", u: "kWh" },
  { v: "water", u: "m³" },
  { v: "diesel", u: "litres" },
  { v: "petrol", u: "litres" },
  { v: "gas", u: "m³" },
  { v: "steam", u: "kg" },
  { v: "compressed_air", u: "m³" },
];

export default function Utilities() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase.from("utilities_kpis").select("*").order("record_date", { ascending: false }).limit(365);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const stats = useMemo(() => {
    const byType: Record<string, { consumption: number; cost: number; unit: string }> = {};
    items.forEach((x) => {
      if (!byType[x.utility_type]) byType[x.utility_type] = { consumption: 0, cost: 0, unit: x.unit };
      byType[x.utility_type].consumption += Number(x.consumption) || 0;
      byType[x.utility_type].cost += Number(x.cost) || 0;
    });
    return byType;
  }, [items]);

  const trend = useMemo(() => {
    const byDate: Record<string, any> = {};
    [...items].reverse().forEach((x) => {
      if (!byDate[x.record_date]) byDate[x.record_date] = { date: x.record_date };
      byDate[x.record_date][x.utility_type] = (byDate[x.record_date][x.utility_type] || 0) + Number(x.consumption || 0);
    });
    return Object.values(byDate).slice(-30);
  }, [items]);

  const totalCost = Object.values(stats).reduce((s, x) => s + x.cost, 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilities KPIs</h1>
          <p className="text-sm text-muted-foreground">Electricity, water, fuel and gas consumption.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Log reading</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total cost</div>
          <div className="mt-1 text-2xl font-semibold">{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</div>
            <div className="mt-1 text-2xl font-semibold">{v.consumption.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm text-muted-foreground">{v.unit}</span></div>
            <div className="text-xs text-muted-foreground">Cost: {v.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
        ))}
      </div>

      {trend.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Consumption trend</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {Object.keys(stats).map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={["hsl(var(--primary))", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#06b6d4", "#a855f7"][i % 7]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<Zap className="h-5 w-5" />} title="No utility readings yet" description="Log your first reading." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Utility</th>
                <th className="px-5 py-3 font-medium">Consumption</th>
                <th className="px-5 py-3 font-medium">Meter</th>
                <th className="px-5 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="px-5 py-3">{formatDate(x.record_date)}</td>
                  <td className="px-5 py-3 capitalize">{x.utility_type?.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{Number(x.consumption).toLocaleString()} {x.unit}</td>
                  <td className="px-5 py-3 text-muted-foreground">{x.meter_reading ?? "—"}</td>
                  <td className="px-5 py-3">{Number(x.cost).toLocaleString()} {x.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dlg open={open} setOpen={setOpen} orgId={profile?.organisation_id} onSaved={load} />
    </div>
  );
}

function Dlg({ open, setOpen, orgId, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    record_date: new Date().toISOString().slice(0, 10),
    utility_type: "electricity", unit: "kWh",
    consumption: 0, cost: 0, meter_reading: "", currency: "TZS", notes: "",
  });

  const setType = (t: string) => {
    const def = TYPES.find((x) => x.v === t);
    setF({ ...f, utility_type: t, unit: def?.u ?? f.unit });
  };

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("utilities_kpis").insert({
      organisation_id: orgId,
      record_date: f.record_date,
      utility_type: f.utility_type,
      unit: f.unit,
      consumption: Number(f.consumption) || 0,
      cost: Number(f.cost) || 0,
      meter_reading: f.meter_reading ? Number(f.meter_reading) : null,
      currency: f.currency,
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
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Log utility reading</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Date</Label><Input type="date" value={f.record_date} onChange={(e) => setF({ ...f, record_date: e.target.value })} className="mt-1" /></div>
          <div><Label>Type</Label>
            <select value={f.utility_type} onChange={(e) => setType(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.v.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Consumption</Label><Input type="number" min={0} step="0.01" value={f.consumption} onChange={(e) => setF({ ...f, consumption: e.target.value })} className="mt-1" /></div>
          <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="mt-1" /></div>
          <div><Label>Meter reading</Label><Input type="number" value={f.meter_reading} onChange={(e) => setF({ ...f, meter_reading: e.target.value })} className="mt-1" /></div>
          <div><Label>Cost</Label><Input type="number" min={0} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} className="mt-1" /></div>
          <div><Label>Currency</Label><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
