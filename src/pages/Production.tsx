import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Target, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const SHIFTS = ["Day", "Evening", "Night"];

const DOWNTIME_REASONS = [
  { code: "breakdown", label: "Breakdown / fault", category: "unplanned" },
  { code: "material_shortage", label: "Material shortage", category: "unplanned" },
  { code: "no_operator", label: "No operator available", category: "unplanned" },
  { code: "quality_hold", label: "Quality hold", category: "unplanned" },
  { code: "utility_failure", label: "Utility failure (power/water/air)", category: "unplanned" },
  { code: "other_unplanned", label: "Other unplanned", category: "unplanned" },
  { code: "changeover", label: "Changeover / setup", category: "planned" },
  { code: "planned_maintenance", label: "Planned maintenance", category: "planned" },
  { code: "break_shift_change", label: "Break / shift change", category: "planned" },
  { code: "cleaning_cip", label: "Cleaning / CIP", category: "planned" },
  { code: "other_planned", label: "Other planned", category: "planned" },
] as const;
const REASON_MAP = new Map(DOWNTIME_REASONS.map((r) => [r.code, r]));

export default function Production() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [downtimeEvents, setDowntimeEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: i }, { data: m }, { data: dt }] = await Promise.all([
      supabase.from("production_kpis").select("*, machines(name)").order("record_date", { ascending: false }).limit(200),
      supabase.from("machines").select("id, name").order("name"),
      supabase.from("production_downtime_events").select("reason_code, category, duration_minutes").order("record_date", { ascending: false }).limit(2000),
    ]);
    setItems(i ?? []);
    setMachines(m ?? []);
    setDowntimeEvents(dt ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const downtimePareto = useMemo(() => {
    const byReason = new Map<string, number>();
    let planned = 0;
    let unplanned = 0;
    for (const e of downtimeEvents) {
      byReason.set(e.reason_code, (byReason.get(e.reason_code) ?? 0) + Number(e.duration_minutes || 0));
      if (e.category === "planned") planned += Number(e.duration_minutes || 0);
      else unplanned += Number(e.duration_minutes || 0);
    }
    const rows = Array.from(byReason.entries())
      .map(([code, minutes]) => ({ code, label: REASON_MAP.get(code as any)?.label ?? code, category: REASON_MAP.get(code as any)?.category ?? "unplanned", minutes }))
      .sort((a, b) => b.minutes - a.minutes);
    return { rows, planned, unplanned };
  }, [downtimeEvents]);

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

      {downtimePareto.rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-medium">Downtime by reason</div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" /> Planned {downtimePareto.planned}m</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 align-middle" /> Unplanned {downtimePareto.unplanned}m</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {downtimePareto.rows.map((r) => {
              const max = downtimePareto.rows[0]?.minutes || 1;
              return (
                <div key={r.code} className="flex items-center gap-3 text-sm">
                  <div className="w-40 shrink-0 truncate">{r.label}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${r.category === "planned" ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.max(4, (r.minutes / max) * 100)}%` }}
                    />
                  </div>
                  <div className="w-14 shrink-0 text-right text-muted-foreground">{r.minutes}m</div>
                </div>
              );
            })}
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
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    record_date: new Date().toISOString().slice(0, 10),
    shift: "Day", machine_id: "", product: "", operator: "",
    target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
    planned_minutes: "", ideal_cycle_seconds: "",
  });
  const [breakdown, setBreakdown] = useState<{ reason_code: string; minutes: string }[]>([]);

  useEffect(() => {
    if (open) {
      setF({
        record_date: new Date().toISOString().slice(0, 10),
        shift: "Day", machine_id: "", product: "", operator: "",
        target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
        planned_minutes: "", ideal_cycle_seconds: "",
      });
      setBreakdown([]);
    }
  }, [open]);

  const breakdownTotal = breakdown.reduce((s, b) => s + (Number(b.minutes) || 0), 0);

  useEffect(() => {
    if (breakdown.length > 0) setF((prev: any) => ({ ...prev, downtime_minutes: breakdownTotal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdownTotal, breakdown.length]);

  const addBreakdownRow = () => setBreakdown((rows) => [...rows, { reason_code: DOWNTIME_REASONS[0].code, minutes: "" }]);
  const removeBreakdownRow = (i: number) => setBreakdown((rows) => rows.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (breakdown.some((b) => !b.minutes || Number(b.minutes) <= 0)) {
      return toast.error("Every downtime reason needs minutes greater than 0");
    }
    setSaving(true);
    const { data: inserted, error } = await supabase.from("production_kpis").insert({
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
      planned_minutes: f.planned_minutes === "" ? null : Number(f.planned_minutes),
      ideal_cycle_seconds: f.ideal_cycle_seconds === "" ? null : Number(f.ideal_cycle_seconds),
    }).select("id").maybeSingle();
    if (!error && inserted && breakdown.length > 0) {
      const { error: dtError } = await supabase.from("production_downtime_events").insert(
        breakdown.map((b) => ({
          organisation_id: orgId,
          production_kpi_id: inserted.id,
          machine_id: f.machine_id || null,
          record_date: f.record_date,
          category: REASON_MAP.get(b.reason_code)?.category ?? "unplanned",
          reason_code: b.reason_code,
          duration_minutes: Number(b.minutes),
          created_by: user?.id ?? null,
        })),
      );
      if (dtError) toast.error(`Saved, but downtime breakdown failed: ${dtError.message}`);
    }
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
          <div>
            <Label>Downtime (min)</Label>
            <Input
              type="number" min={0} value={f.downtime_minutes}
              onChange={(e) => setF({ ...f, downtime_minutes: e.target.value })}
              disabled={breakdown.length > 0}
              className="mt-1"
            />
            {breakdown.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Auto-summed from the reasons below.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label>Downtime breakdown (optional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addBreakdownRow}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add reason
            </Button>
          </div>
          {breakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">Break the downtime total down by reason so it can be tracked on a Pareto chart, instead of one raw number.</p>
          ) : (
            <div className="space-y-2">
              {breakdown.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={b.reason_code}
                    onChange={(e) => setBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, reason_code: e.target.value } : r))}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <optgroup label="Unplanned">
                      {DOWNTIME_REASONS.filter((r) => r.category === "unplanned").map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </optgroup>
                    <optgroup label="Planned">
                      {DOWNTIME_REASONS.filter((r) => r.category === "planned").map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </optgroup>
                  </select>
                  <Input
                    type="number" min={0} placeholder="min" value={b.minutes}
                    onChange={(e) => setBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, minutes: e.target.value } : r))}
                    className="w-24"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBreakdownRow(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Optional — fill these in to automatically feed today's OEE record for this machine (no need to enter it again on the OEE page).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Planned run time (min)</Label><Input type="number" min={0} placeholder="e.g. 480" value={f.planned_minutes} onChange={(e) => setF({ ...f, planned_minutes: e.target.value })} className="mt-1" /></div>
            <div><Label>Ideal cycle time (sec/unit)</Label><Input type="number" min={0} step="0.01" placeholder="e.g. 12.5" value={f.ideal_cycle_seconds} onChange={(e) => setF({ ...f, ideal_cycle_seconds: e.target.value })} className="mt-1" /></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
