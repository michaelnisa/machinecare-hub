import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Target, Plus, Loader2, X, CheckCircle2, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTZS } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function monthBounds(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
}

const SHIFTS = ["Day", "Evening", "Night"];
const LINE_STORAGE_KEY = "production.lastLine";

// Fire-and-forget: asks send-production-alert to recompute the org's
// attainment/downtime thresholds against this log and, if breached, email
// (and for critical breaches, SMS) production staff + owners/managers
// immediately. Never blocks or fails the save — the in-app bell
// notification already happened via the DB trigger regardless of this.
function triggerProductionAlert(productionKpiId: string) {
  supabase.functions.invoke("send-production-alert", { body: { productionKpiId } })
    .catch((e) => console.error("send-production-alert failed", e));
}

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

const SCRAP_REASONS = [
  { code: "giveaway_overfill", label: "Giveaway / overfill" },
  { code: "underweight_reject", label: "Underweight / reject" },
  { code: "label_defect", label: "Label / print defect" },
  { code: "contamination", label: "Contamination" },
  { code: "changeover_waste", label: "Changeover waste" },
  { code: "damaged_packaging", label: "Damaged packaging" },
  { code: "other", label: "Other" },
] as const;
const SCRAP_REASON_MAP = new Map(SCRAP_REASONS.map((r) => [r.code, r]));

export default function Production() {
  const { profile, user, organisation } = useAuth();
  const { isOwner, isManager, isEngineer } = useUserRole();
  const canApprove = isOwner || isManager || isEngineer;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [downtimeEvents, setDowntimeEvents] = useState<any[]>([]);
  const [scrapEvents, setScrapEvents] = useState<any[]>([]);
  const [linkedWorkOrders, setLinkedWorkOrders] = useState<any[]>([]);
  const [orgCfg, setOrgCfg] = useState<{
    production_cost_per_downtime_minute: number | null;
    production_cost_per_scrap_unit: number | null;
  }>({ production_cost_per_downtime_minute: null, production_cost_per_scrap_unit: null });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [machineFilter, setMachineFilter] = useState<string>("all");

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { startISO, endISO } = monthBounds(month);
    const [
      { data: i, error: e1 },
      { data: m, error: e2 },
      { data: dt, error: e3 },
      { data: sc, error: e4 },
      { data: pr, error: e5 },
      { data: cfg },
    ] = await Promise.all([
      supabase.from("production_kpis").select("*, machines(name)").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(2000),
      supabase.from("machines").select("id, name").order("name"),
      supabase.from("production_downtime_events").select("*").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(5000),
      (supabase as any).from("production_scrap_events").select("*").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(5000),
      (supabase as any).from("products").select("*").eq("is_active", true).order("name"),
      (supabase as any)
        .from("organisations")
        .select("production_cost_per_downtime_minute, production_cost_per_scrap_unit")
        .eq("id", profile.organisation_id)
        .maybeSingle(),
    ]);
    const err = e1 || e2 || e3 || e4 || e5;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    setMachines(m ?? []);
    setDowntimeEvents(dt ?? []);
    setScrapEvents(sc ?? []);
    setProducts(pr ?? []);
    if (cfg) setOrgCfg(cfg);

    const woIds = Array.from(new Set((dt ?? []).map((e: any) => e.work_order_id).filter(Boolean)));
    if (woIds.length) {
      const { data: wos } = await supabase.from("work_orders").select("id, machine_id, started_at, finished_at").in("id", woIds);
      setLinkedWorkOrders(wos ?? []);
    } else {
      setLinkedWorkOrders([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile, month]);

  const filteredItems = useMemo(
    () => (machineFilter === "all" ? items : items.filter((x) => x.machine_id === machineFilter)),
    [items, machineFilter]
  );
  const filteredDowntimeEvents = useMemo(
    () => (machineFilter === "all" ? downtimeEvents : downtimeEvents.filter((e) => e.machine_id === machineFilter)),
    [downtimeEvents, machineFilter]
  );
  const filteredScrapEvents = useMemo(
    () => (machineFilter === "all" ? scrapEvents : scrapEvents.filter((e) => e.machine_id === machineFilter)),
    [scrapEvents, machineFilter]
  );
  const productionLines = useMemo(
    () => Array.from(new Set(items.map((x) => x.production_line).filter(Boolean))).sort(),
    [items]
  );

  const downtimePareto = useMemo(() => {
    const byReason = new Map<string, number>();
    let planned = 0;
    let unplanned = 0;
    for (const e of filteredDowntimeEvents) {
      byReason.set(e.reason_code, (byReason.get(e.reason_code) ?? 0) + Number(e.duration_minutes || 0));
      if (e.category === "planned") planned += Number(e.duration_minutes || 0);
      else unplanned += Number(e.duration_minutes || 0);
    }
    const rows = Array.from(byReason.entries())
      .map(([code, minutes]) => ({ code, label: REASON_MAP.get(code as any)?.label ?? code, category: REASON_MAP.get(code as any)?.category ?? "unplanned", minutes }))
      .sort((a, b) => b.minutes - a.minutes);
    return { rows, planned, unplanned };
  }, [filteredDowntimeEvents]);

  const scrapPareto = useMemo(() => {
    const byReason = new Map<string, number>();
    for (const e of filteredScrapEvents) {
      byReason.set(e.reason_code, (byReason.get(e.reason_code) ?? 0) + Number(e.quantity || 0));
    }
    return Array.from(byReason.entries())
      .map(([code, qty]) => ({ code, label: SCRAP_REASON_MAP.get(code as any)?.label ?? code, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [filteredScrapEvents]);

  const stats = useMemo(() => {
    const target = filteredItems.reduce((s, x) => s + (x.target_units || 0), 0);
    const actual = filteredItems.reduce((s, x) => s + (x.actual_units || 0), 0);
    const scrap = filteredItems.reduce((s, x) => s + (x.scrap_units || 0), 0);
    const down = filteredItems.reduce((s, x) => s + (x.downtime_minutes || 0), 0);
    const costPerMinute = Number(orgCfg.production_cost_per_downtime_minute) || 0;
    const costPerUnit = Number(orgCfg.production_cost_per_scrap_unit) || 0;
    const costEnabled = orgCfg.production_cost_per_downtime_minute != null || orgCfg.production_cost_per_scrap_unit != null;
    const costLost = down * costPerMinute + scrap * costPerUnit;
    return { target, actual, scrap, down, att: target > 0 ? (actual / target * 100) : 0, costLost, costEnabled };
  }, [filteredItems, orgCfg]);

  const trend = useMemo(() => {
    const byDate: Record<string, { date: string; target: number; actual: number }> = {};
    [...filteredItems].reverse().forEach((x) => {
      const d = x.record_date;
      if (!byDate[d]) byDate[d] = { date: d, target: 0, actual: 0 };
      byDate[d].target += x.target_units || 0;
      byDate[d].actual += x.actual_units || 0;
    });
    return Object.values(byDate);
  }, [filteredItems]);

  const lineRollup = useMemo(() => {
    const byLine = new Map<string, { line: string; target: number; actual: number; machines: Map<string, { name: string; target: number; actual: number }> }>();
    for (const x of filteredItems) {
      const line = x.production_line || "Unassigned";
      if (!byLine.has(line)) byLine.set(line, { line, target: 0, actual: 0, machines: new Map() });
      const row = byLine.get(line)!;
      row.target += x.target_units || 0;
      row.actual += x.actual_units || 0;
      const mName = x.machines?.name ?? "—";
      if (!row.machines.has(mName)) row.machines.set(mName, { name: mName, target: 0, actual: 0 });
      const mRow = row.machines.get(mName)!;
      mRow.target += x.target_units || 0;
      mRow.actual += x.actual_units || 0;
    }
    return Array.from(byLine.values())
      .filter((r) => r.line !== "Unassigned" || byLine.size === 1)
      .map((r) => {
        const machineRows = Array.from(r.machines.values()).map((m) => ({ ...m, att: m.target > 0 ? (m.actual / m.target) * 100 : 0 }));
        machineRows.sort((a, b) => a.att - b.att);
        return { ...r, att: r.target > 0 ? (r.actual / r.target) * 100 : 0, bottleneck: machineRows[0] };
      });
  }, [filteredItems]);

  const reliability = useMemo(() => {
    const byMachine = new Map<string, { name: string; repairs: number[]; failureDates: number[] }>();
    const woById = new Map(linkedWorkOrders.map((w) => [w.id, w]));
    for (const e of filteredDowntimeEvents) {
      if (e.reason_code !== "breakdown" || !e.machine_id) continue;
      const machine = machines.find((m) => m.id === e.machine_id);
      const name = machine?.name ?? "—";
      if (!byMachine.has(e.machine_id)) byMachine.set(e.machine_id, { name, repairs: [], failureDates: [] });
      const row = byMachine.get(e.machine_id)!;
      row.failureDates.push(new Date(e.record_date).getTime());
      if (e.work_order_id) {
        const wo = woById.get(e.work_order_id);
        if (wo?.started_at && wo?.finished_at) {
          row.repairs.push((new Date(wo.finished_at).getTime() - new Date(wo.started_at).getTime()) / 3600000);
        }
      }
    }
    return Array.from(byMachine.entries()).map(([machineId, row]) => {
      const mttr = row.repairs.length ? row.repairs.reduce((s, v) => s + v, 0) / row.repairs.length : null;
      const sortedDates = [...row.failureDates].sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) gaps.push((sortedDates[i] - sortedDates[i - 1]) / 86400000);
      const mtbf = gaps.length ? gaps.reduce((s, v) => s + v, 0) / gaps.length : null;
      return { machineId, name: row.name, mttr, mtbf, failures: row.failureDates.length };
    }).filter((r) => r.failures > 0);
  }, [filteredDowntimeEvents, linkedWorkOrders, machines]);

  const approveLog = async (id: string) => {
    const { error } = await supabase
      .from("production_kpis")
      .update({ log_status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Log approved");
    load();
  };

  const deleteLog = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("production_kpis").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Log deleted");
    load();
  };

  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push(["MachineCare Production Log", organisation?.name ?? "", month]);
    rows.push([]);
    rows.push(["Date", "Shift", "Machine", "Line", "Product", "Operator", "Target", "Actual", "Scrap", "Downtime (min)", "Attainment %", "Status"]);
    filteredItems.forEach((x) => rows.push([
      x.record_date, x.shift ?? "", x.machines?.name ?? "", x.production_line ?? "", x.product ?? "", x.operator ?? "",
      String(x.target_units ?? 0), String(x.actual_units ?? 0), String(x.scrap_units ?? 0), String(x.downtime_minutes ?? 0),
      Number(x.attainment_percent || 0).toFixed(1), x.log_status ?? "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-log-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production KPIs</h1>
          <p className="text-sm text-muted-foreground">Daily target vs actual, scrap and downtime.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button variant="outline" onClick={exportCSV} disabled={filteredItems.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          <Button variant="outline" asChild><Link to="/inventory/production-materials">Material readiness</Link></Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Log production</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Target units", value: stats.target },
          { label: "Actual units", value: stats.actual },
          { label: "Attainment", value: `${stats.att.toFixed(1)}%` },
          { label: "Scrap", value: stats.scrap },
          stats.costEnabled
            ? { label: "Cost lost", value: formatTZS(stats.costLost) }
            : { label: "Downtime (min)", value: stats.down },
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

      {lineRollup.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">By production line</div>
          <div className="space-y-3">
            {lineRollup.map((r) => (
              <div key={r.line} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.line}</div>
                  <div className="text-muted-foreground">{r.actual}/{r.target} units · {r.att.toFixed(1)}%</div>
                </div>
                {r.bottleneck && r.machines.size > 1 && (
                  <div className="mt-1 text-xs text-amber-700">
                    Bottleneck: {r.bottleneck.name} ({r.bottleneck.att.toFixed(1)}% attainment)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reliability.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Reliability — breakdown-driven machines</div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Machine</th>
                <th className="py-2 font-medium">Breakdowns</th>
                <th className="py-2 font-medium">MTTR</th>
                <th className="py-2 font-medium">MTBF</th>
              </tr>
            </thead>
            <tbody>
              {reliability.map((r) => (
                <tr key={r.machineId} className="border-t border-border">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">{r.failures}</td>
                  <td className="py-2">{r.mttr != null ? `${r.mttr.toFixed(1)}h` : "—"}</td>
                  <td className="py-2">{r.mtbf != null ? `${r.mtbf.toFixed(1)}d` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  {orgCfg.production_cost_per_downtime_minute != null && (
                    <div className="w-28 shrink-0 text-right text-muted-foreground">
                      {formatTZS(r.minutes * Number(orgCfg.production_cost_per_downtime_minute))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scrapPareto.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 text-sm font-medium">Scrap by reason</div>
          <div className="mt-3 space-y-2">
            {scrapPareto.map((r) => {
              const max = scrapPareto[0]?.qty || 1;
              return (
                <div key={r.code} className="flex items-center gap-3 text-sm">
                  <div className="w-40 shrink-0 truncate">{r.label}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, (r.qty / max) * 100)}%` }} />
                  </div>
                  <div className="w-14 shrink-0 text-right text-muted-foreground">{r.qty}</div>
                  {orgCfg.production_cost_per_scrap_unit != null && (
                    <div className="w-28 shrink-0 text-right text-muted-foreground">
                      {formatTZS(r.qty * Number(orgCfg.production_cost_per_scrap_unit))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title="No production logs" description="Log the first shift to see KPIs." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
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
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((x) => (
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
                  <td className="px-5 py-3">
                    {x.log_status === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    ) : canApprove ? (
                      <Button size="sm" variant="outline" onClick={() => approveLog(x.id)}>Approve</Button>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">Submitted</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {x.log_status !== "approved" && (
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(x); setOpen(true); }} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isManager && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(x)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dlg open={open} setOpen={setOpen} machines={machines} products={products} orgId={profile?.organisation_id} onSaved={load} editing={editing} productionLines={productionLines} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this production log?"
        description={deleteTarget ? `${formatDate(deleteTarget.record_date)}${deleteTarget.shift ? ` · ${deleteTarget.shift}` : ""} — this can't be undone. Linked downtime/scrap breakdown rows and OEE totals stay as they were.` : undefined}
        onConfirm={deleteLog}
      />
    </div>
  );
}

function Dlg({ open, setOpen, machines, products, orgId, onSaved, editing, productionLines }: any) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({
    record_date: new Date().toISOString().slice(0, 10),
    shift: "Day", machine_id: "", product: "", product_id: "", operator: "",
    target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
    planned_minutes: "", ideal_cycle_seconds: "", production_line: "",
  });
  const [breakdown, setBreakdown] = useState<{ reason_code: string; minutes: string }[]>([]);
  const [scrapBreakdown, setScrapBreakdown] = useState<{ reason_code: string; qty: string }[]>([]);

  useEffect(() => {
    if (open && editing) {
      setF({
        record_date: editing.record_date, shift: editing.shift ?? "Day", machine_id: editing.machine_id ?? "",
        product: editing.product ?? "", product_id: editing.product_id ?? "", operator: editing.operator ?? "",
        target_units: editing.target_units ?? 0, actual_units: editing.actual_units ?? 0,
        scrap_units: editing.scrap_units ?? 0, downtime_minutes: editing.downtime_minutes ?? 0,
        notes: editing.notes ?? "", planned_minutes: editing.planned_minutes ?? "", ideal_cycle_seconds: editing.ideal_cycle_seconds ?? "",
        production_line: editing.production_line ?? "",
      });
      setBreakdown([]);
      setScrapBreakdown([]);
    } else if (open) {
      setF({
        record_date: new Date().toISOString().slice(0, 10),
        shift: "Day", machine_id: "", product: "", product_id: "", operator: "",
        target_units: 0, actual_units: 0, scrap_units: 0, downtime_minutes: 0, notes: "",
        planned_minutes: "", ideal_cycle_seconds: "",
        production_line: localStorage.getItem(LINE_STORAGE_KEY) ?? "",
      });
      setBreakdown([]);
      setScrapBreakdown([]);
    }
  }, [open, editing]);

  const breakdownTotal = breakdown.reduce((s, b) => s + (Number(b.minutes) || 0), 0);
  const scrapTotal = scrapBreakdown.reduce((s, b) => s + (Number(b.qty) || 0), 0);

  useEffect(() => {
    if (breakdown.length > 0) setF((prev: any) => ({ ...prev, downtime_minutes: breakdownTotal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdownTotal, breakdown.length]);

  useEffect(() => {
    if (scrapBreakdown.length > 0) setF((prev: any) => ({ ...prev, scrap_units: scrapTotal }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapTotal, scrapBreakdown.length]);

  const addBreakdownRow = () => setBreakdown((rows) => [...rows, { reason_code: DOWNTIME_REASONS[0].code, minutes: "" }]);
  const removeBreakdownRow = (i: number) => setBreakdown((rows) => rows.filter((_, idx) => idx !== i));

  const addScrapRow = () => setScrapBreakdown((rows) => [...rows, { reason_code: SCRAP_REASONS[0].code, qty: "" }]);
  const removeScrapRow = (i: number) => setScrapBreakdown((rows) => rows.filter((_, idx) => idx !== i));

  const onProductChange = (productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    setF((prev: any) => ({
      ...prev,
      product_id: productId,
      product: p?.name ?? prev.product,
      ideal_cycle_seconds: p?.ideal_cycle_seconds ?? prev.ideal_cycle_seconds,
    }));
  };

  const submit = async () => {
    if (breakdown.some((b) => !b.minutes || Number(b.minutes) <= 0)) {
      return toast.error("Every downtime reason needs minutes greater than 0");
    }
    if (scrapBreakdown.some((b) => !b.qty || Number(b.qty) <= 0)) {
      return toast.error("Every scrap reason needs a quantity greater than 0");
    }
    setSaving(true);
    if (f.production_line?.trim()) localStorage.setItem(LINE_STORAGE_KEY, f.production_line.trim());

    if (editing) {
      const { error: updateError } = await supabase.from("production_kpis").update({
        machine_id: f.machine_id || null,
        record_date: f.record_date,
        shift: f.shift || null,
        product: f.product || null,
        product_id: f.product_id || null,
        operator: f.operator || null,
        target_units: Number(f.target_units) || 0,
        actual_units: Number(f.actual_units) || 0,
        scrap_units: Number(f.scrap_units) || 0,
        downtime_minutes: Number(f.downtime_minutes) || 0,
        notes: f.notes || null,
        planned_minutes: f.planned_minutes === "" ? null : Number(f.planned_minutes),
        ideal_cycle_seconds: f.ideal_cycle_seconds === "" ? null : Number(f.ideal_cycle_seconds),
        production_line: f.production_line?.trim() || null,
      } as any).eq("id", editing.id);
      setSaving(false);
      if (updateError) return toast.error(updateError.message);
      toast.success("Updated");
      setOpen(false);
      onSaved();
      triggerProductionAlert(editing.id);
      return;
    }

    const { data: inserted, error } = await supabase.from("production_kpis").insert({
      organisation_id: orgId,
      machine_id: f.machine_id || null,
      record_date: f.record_date,
      shift: f.shift || null,
      product: f.product || null,
      product_id: f.product_id || null,
      operator: f.operator || null,
      target_units: Number(f.target_units) || 0,
      actual_units: Number(f.actual_units) || 0,
      scrap_units: Number(f.scrap_units) || 0,
      downtime_minutes: Number(f.downtime_minutes) || 0,
      notes: f.notes || null,
      planned_minutes: f.planned_minutes === "" ? null : Number(f.planned_minutes),
      ideal_cycle_seconds: f.ideal_cycle_seconds === "" ? null : Number(f.ideal_cycle_seconds),
      production_line: f.production_line?.trim() || null,
    } as any).select("id").maybeSingle();

    if (!error && inserted && breakdown.length > 0) {
      const rows = breakdown.map((b) => ({
        organisation_id: orgId,
        production_kpi_id: inserted.id,
        machine_id: f.machine_id || null,
        record_date: f.record_date,
        category: REASON_MAP.get(b.reason_code)?.category ?? "unplanned",
        reason_code: b.reason_code,
        duration_minutes: Number(b.minutes),
        created_by: user?.id ?? null,
      }));
      const { data: insertedDt, error: dtError } = await supabase.from("production_downtime_events").insert(rows).select("id, reason_code");
      if (dtError) {
        toast.error(`Saved, but downtime breakdown failed: ${dtError.message}`);
      } else if (f.machine_id) {
        // Auto-create a work order for genuine equipment breakdowns so
        // maintenance is notified immediately instead of finding out at
        // end-of-shift review. Non-blocking: failures here don't undo the save.
        const breakdownEventIds = (insertedDt ?? []).filter((r: any) => r.reason_code === "breakdown").map((r: any) => r.id);
        if (breakdownEventIds.length > 0) {
          const machine = machines.find((m: any) => m.id === f.machine_id);
          const { data: wo, error: woError } = await supabase.from("work_orders").insert({
            organisation_id: orgId,
            machine_id: f.machine_id,
            title: `Breakdown — ${machine?.name ?? "machine"} (${f.record_date}${f.shift ? " " + f.shift : ""})`,
            description: f.notes || "Auto-created from a production breakdown log.",
            priority: "high",
            status: "open",
            work_type: "repair",
            created_by: user?.id ?? null,
          } as any).select("id").maybeSingle();
          if (woError || !wo) {
            toast.error(`Saved, but auto work order failed: ${woError?.message ?? "unknown error"}`);
          } else {
            await supabase.from("production_downtime_events").update({ work_order_id: wo.id } as any).in("id", breakdownEventIds);
            await supabase.from("maintenance_notifications").insert({
              organisation_id: orgId,
              machine_id: f.machine_id,
              title: `Breakdown reported — ${machine?.name ?? "machine"}`,
              description: `Work order created from the production log for ${f.record_date}${f.shift ? " " + f.shift : ""}.`,
              severity: "high",
              reported_by: user?.id ?? null,
              work_order_id: wo.id,
            });
          }
        }
      }
    }

    if (!error && inserted && scrapBreakdown.length > 0) {
      const rows = scrapBreakdown.map((b) => ({
        organisation_id: orgId,
        production_kpi_id: inserted.id,
        machine_id: f.machine_id || null,
        record_date: f.record_date,
        reason_code: b.reason_code,
        quantity: Number(b.qty),
        created_by: user?.id ?? null,
      }));
      const { error: scError } = await (supabase as any).from("production_scrap_events").insert(rows);
      if (scError) toast.error(`Saved, but scrap breakdown failed: ${scError.message}`);
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    onSaved();
    if (inserted) triggerProductionAlert(inserted.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit production log" : "Log production"}</DialogTitle></DialogHeader>
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
          <div>
            <Label>Production line (optional)</Label>
            <Input placeholder="e.g. Bottling Line 1" list="production-line-options" value={f.production_line} onChange={(e) => setF({ ...f, production_line: e.target.value })} className="mt-1" />
            <datalist id="production-line-options">
              {(productionLines ?? []).map((l: string) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div>
            <Label>Product</Label>
            <select value={f.product_id} onChange={(e) => onProductChange(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— select or type below —</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
            </select>
            <Input
              placeholder="Or type a product name"
              value={f.product}
              onChange={(e) => setF({ ...f, product: e.target.value, product_id: "" })}
              className="mt-1.5"
            />
          </div>
          <div><Label>Operator</Label><Input value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className="mt-1" /></div>
          <div><Label>Target units</Label><Input type="number" min={0} value={f.target_units} onChange={(e) => setF({ ...f, target_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Actual units</Label><Input type="number" min={0} value={f.actual_units} onChange={(e) => setF({ ...f, actual_units: e.target.value })} className="mt-1" /></div>
          <div><Label>Scrap units</Label>
            <Input
              type="number" min={0} value={f.scrap_units}
              onChange={(e) => setF({ ...f, scrap_units: e.target.value })}
              disabled={scrapBreakdown.length > 0}
              className="mt-1"
            />
            {scrapBreakdown.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Auto-summed from the reasons below.</p>}
          </div>
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

        {editing && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Editing updates the summary numbers only. Downtime/scrap breakdown detail and the auto-created work order (if any) stay as originally logged.
          </p>
        )}

        {!editing && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label>Downtime breakdown (optional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addBreakdownRow}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add reason
            </Button>
          </div>
          {breakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Break the downtime total down by reason so it can be tracked on a Pareto chart. Choosing "Breakdown / fault" auto-creates a work order for maintenance.
            </p>
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
        )}

        {!editing && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label>Scrap breakdown (optional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addScrapRow}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add reason
            </Button>
          </div>
          {scrapBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">Break scrap down by cause instead of one raw number.</p>
          ) : (
            <div className="space-y-2">
              {scrapBreakdown.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={b.reason_code}
                    onChange={(e) => setScrapBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, reason_code: e.target.value } : r))}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {SCRAP_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                  <Input
                    type="number" min={0} placeholder="qty" value={b.qty}
                    onChange={(e) => setScrapBreakdown((rows) => rows.map((r, idx) => idx === i ? { ...r, qty: e.target.value } : r))}
                    className="w-24"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeScrapRow(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

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
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
