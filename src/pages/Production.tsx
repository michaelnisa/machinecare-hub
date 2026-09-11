import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Target, AlertTriangle, Wrench, ClipboardList, BookOpen, BarChart2, TrendingUp, TrendingDown, Clock, Factory } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTZS } from "@/lib/format";
import { REASON_MAP, SCRAP_REASON_MAP } from "@/lib/production-constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const toneClasses: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatPoNumber(year: number | null | undefined, n: number | null | undefined) {
  if (!n) return "—";
  const y = year ?? new Date().getFullYear();
  return `PO-${y}-${String(n).padStart(4, "0")}`;
}

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
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [prodLines, setProdLines] = useState<any[]>([]);
  const [orgCfg, setOrgCfg] = useState<{
    production_cost_per_downtime_minute: number | null;
    production_cost_per_scrap_unit: number | null;
  }>({ production_cost_per_downtime_minute: null, production_cost_per_scrap_unit: null });
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
      { data: poData },
      { data: plData },
    ] = await Promise.all([
      (supabase as any).from("production_kpis").select("*, machines(name), production_orders(id, po_number, po_year)").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(2000),
      supabase.from("machines").select("id, name").order("name"),
      supabase.from("production_downtime_events").select("*").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(5000),
      (supabase as any).from("production_scrap_events").select("*").gte("record_date", startISO).lt("record_date", endISO).order("record_date", { ascending: false }).limit(5000),
      (supabase as any).from("products").select("*").eq("is_active", true).order("name"),
      (supabase as any)
        .from("organisations")
        .select("production_cost_per_downtime_minute, production_cost_per_scrap_unit")
        .eq("id", profile.organisation_id)
        .maybeSingle(),
      (supabase as any)
        .from("production_orders")
        .select("id, po_number, po_year, product, product_id, batch_number, production_line, production_line_id, quantity_ordered, quantity_produced, status")
        .in("status", ["planned", "released", "in_progress"])
        .order("created_at", { ascending: false }),
      (supabase as any).from("production_lines").select("*").eq("is_active", true).order("name"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5;
    if (err) toast.error(err.message);
    setItems(i ?? []);
    setMachines(m ?? []);
    setDowntimeEvents(dt ?? []);
    setScrapEvents(sc ?? []);
    setProducts(pr ?? []);
    setActiveOrders(poData ?? []);
    setProdLines(plData ?? []);
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

  const unlinkedBreakdowns = useMemo(() => {
    return filteredDowntimeEvents.filter((e) => e.category === "unplanned" && !e.work_order_id && e.machine_id);
  }, [filteredDowntimeEvents]);

  const raiseWorkOrderForDowntime = async (event: any) => {
    if (!profile || !event.machine_id) return;
    const machine = machines.find((m: any) => m.id === event.machine_id);
    const reason = REASON_MAP.get(event.reason_code)?.label ?? event.reason_code;
    const { data: wo, error: woError } = await supabase.from("work_orders").insert({
      organisation_id: profile.organisation_id,
      machine_id: event.machine_id,
      title: `Unplanned Downtime (${reason}) — ${machine?.name ?? "Machine"}`,
      description: `Raised from Production Downtime Log on ${event.record_date} (${event.duration_minutes} min). Reason: ${reason}.`,
      priority: "high",
      status: "open",
      work_type: "repair",
      created_by: user?.id ?? null,
    } as any).select("id").maybeSingle();

    if (woError || !wo) {
      toast.error(`Failed to raise work order: ${woError?.message || "Unknown error"}`);
      return;
    }

    await supabase.from("production_downtime_events").update({ work_order_id: wo.id } as any).eq("id", event.id);
    await supabase.from("maintenance_notifications").insert({
      organisation_id: profile.organisation_id,
      machine_id: event.machine_id,
      title: `Breakdown Work Order Raised — ${machine?.name ?? "Machine"}`,
      description: `Production reported ${event.duration_minutes}m downtime due to ${reason}. Work order created.`,
      severity: "high",
      reported_by: user?.id ?? null,
      work_order_id: wo.id,
    } as any);

    toast.success("Work order raised and maintenance notified!");
    load();
  };

  const kpiCards = [
    {
      label: "Target Units",
      value: String(stats.target.toLocaleString()),
      sub: `${month} · ${machineFilter === "all" ? "all machines" : machines.find(m => m.id === machineFilter)?.name ?? ""}`,
      icon: Target,
      tone: "default",
    },
    {
      label: "Actual Units",
      value: String(stats.actual.toLocaleString()),
      sub: stats.att > 0 ? `${stats.att.toFixed(1)}% of target` : "No target set",
      icon: BarChart2,
      tone: stats.att >= 90 ? "success" : stats.att >= 70 ? "warning" : "destructive",
    },
    {
      label: "Attainment",
      value: `${stats.att.toFixed(1)}%`,
      sub: stats.target > 0 ? `${(stats.target - stats.actual).toLocaleString()} units short` : "No target set",
      icon: TrendingUp,
      tone: stats.att >= 90 ? "success" : stats.att >= 70 ? "warning" : "destructive",
    },
    {
      label: "Scrap",
      value: String(stats.scrap.toLocaleString()),
      sub: stats.actual > 0 ? `${((stats.scrap / stats.actual) * 100).toFixed(1)}% scrap rate` : "—",
      icon: AlertTriangle,
      tone: stats.scrap === 0 ? "success" : "warning",
    },
    stats.costEnabled
      ? {
          label: "Cost of Losses",
          value: formatTZS(stats.costLost),
          sub: `Downtime + scrap cost for ${month}`,
          icon: TrendingDown,
          tone: stats.costLost > 0 ? "destructive" : "success",
        }
      : {
          label: "Total Downtime",
          value: `${stats.down}m`,
          sub: stats.down > 0 ? `${(stats.down / 60).toFixed(1)}h lost this period` : "No downtime recorded",
          icon: Clock,
          tone: stats.down === 0 ? "success" : stats.down > 120 ? "destructive" : "warning",
        },
  ] as const;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production Dashboard</h1>
          <p className="text-sm text-muted-foreground">KPIs, attainment trends and machine analytics for {month}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/production/orders"><ClipboardList className="mr-1.5 h-4 w-4" /> Orders</Link>
          </Button>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button asChild>
            <Link to="/production/log"><BookOpen className="mr-2 h-4 w-4" /> Production Log</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards — Fleet style */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[c.tone]}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend + Line Rollup — side by side on large screens */}
      {(trend.length > 1 || lineRollup.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {trend.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-foreground">Target vs Actual</h2>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="target" fill="hsl(var(--muted-foreground))" name="Target" radius={[2,2,0,0]} />
                    <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {lineRollup.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Factory className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-foreground">By Production Line</h2>
              </div>
              <div className="space-y-2">
                {lineRollup.map((r) => {
                  const attPct = r.target > 0 ? (r.actual / r.target) * 100 : 0;
                  return (
                    <div key={r.line} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.line}</span>
                        <span className={`text-xs font-semibold ${attPct >= 90 ? "text-green-600" : attPct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                          {attPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${attPct >= 90 ? "bg-green-500" : attPct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, attPct)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.actual.toLocaleString()} / {r.target.toLocaleString()} units
                        {r.bottleneck && r.machines.size > 1 && (
                          <span className="ml-2 text-amber-600">· Bottleneck: {r.bottleneck.name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reliability + Downtime Pareto — side by side */}
      {(reliability.length > 0 || downtimePareto.rows.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {reliability.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-foreground">Machine Reliability</h2>
              </div>
              <div className="space-y-2">
                {reliability.map((r) => (
                  <div key={r.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-medium">{r.name}</span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{r.failures} breakdowns</span>
                      <span>MTTR {r.mttr != null ? `${r.mttr.toFixed(1)}h` : "—"}</span>
                      <span>MTBF {r.mtbf != null ? `${r.mtbf.toFixed(1)}d` : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {downtimePareto.rows.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-foreground">Downtime by Reason</h2>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500 align-middle mr-1" />Planned {downtimePareto.planned}m</span>
                  <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 align-middle mr-1" />Unplanned {downtimePareto.unplanned}m</span>
                </div>
              </div>
              <div className="space-y-2">
                {downtimePareto.rows.map((r) => {
                  const max = downtimePareto.rows[0]?.minutes || 1;
                  return (
                    <div key={r.code} className="flex items-center gap-3 text-sm">
                      <div className="w-36 shrink-0 truncate text-xs">{r.label}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${r.category === "planned" ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.max(4, (r.minutes / max) * 100)}%` }}
                        />
                      </div>
                      <div className="w-12 shrink-0 text-right text-xs text-muted-foreground">{r.minutes}m</div>
                      {orgCfg.production_cost_per_downtime_minute != null && (
                        <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                          {formatTZS(r.minutes * Number(orgCfg.production_cost_per_downtime_minute))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrap Pareto */}
      {scrapPareto.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Scrap by Reason</h2>
          </div>
          <div className="space-y-2">
            {scrapPareto.map((r) => {
              const max = scrapPareto[0]?.qty || 1;
              return (
                <div key={r.code} className="flex items-center gap-3 text-sm">
                  <div className="w-36 shrink-0 truncate text-xs">{r.label}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, (r.qty / max) * 100)}%` }} />
                  </div>
                  <div className="w-12 shrink-0 text-right text-xs text-muted-foreground">{r.qty}</div>
                  {orgCfg.production_cost_per_scrap_unit != null && (
                    <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {formatTZS(r.qty * Number(orgCfg.production_cost_per_scrap_unit))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Andon bridge: unlinked breakdowns */}
      {unlinkedBreakdowns.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 p-5 dark:bg-amber-950/20">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Unplanned Downtime Without Work Orders ({unlinkedBreakdowns.length})
              </h2>
            </div>
            <Link to="/production/log" className="text-xs font-medium text-primary hover:underline">View log →</Link>
          </div>
          <div className="space-y-2">
            {unlinkedBreakdowns.slice(0, 5).map((evt: any) => {
              const mName = machines.find((m: any) => m.id === evt.machine_id)?.name ?? "Machine";
              const rLabel = REASON_MAP.get(evt.reason_code)?.label ?? evt.reason_code;
              return (
                <div key={evt.id} className="flex flex-wrap items-center justify-between rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2 dark:bg-slate-900/40 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mName}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(evt.record_date)}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {rLabel} · {evt.duration_minutes}m
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 hover:bg-amber-100" onClick={() => raiseWorkOrderForDowntime(evt)}>
                    <Wrench className="mr-1 h-3 w-3 text-amber-600" /> Raise Work Order
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log page link card */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Shift logs for {month}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {filteredItems.length} {filteredItems.length === 1 ? "entry" : "entries"} recorded — add, edit, approve and export on the Production Log page.
          </div>
        </div>
        <Button asChild>
          <Link to="/production/log"><BookOpen className="mr-2 h-4 w-4" /> Open Production Log</Link>
        </Button>
      </div>
    </div>
  );
}
