import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Gauge, Wrench, AlertTriangle, Fuel, ClipboardCheck, Package } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";

const RANGE_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
];

type Machine = { id: string; name: string; plate_number: string | null; current_odometer_km: number | null };
type WorkOrder = { id: string; machine_id: string; status: string; created_at: string; completed_at: string | null; labor_cost: number | null };
type ServiceLog = { id: string; machine_id: string; cost: number | null; performed_at: string };
type ServicePart = { id: string; service_log_id: string; quantity: number | null; unit_cost: number | null; part_name: string; inventory_item_id: string | null };
type InventoryItem = { id: string; category: string | null; order_status: string | null };
type Trip = { machine_id: string; start_odo: number | null; end_odo: number | null; status: string };
type FaultReport = { machine_id: string; created_at: string; description: string };
type Execution = { machine_id: string; performed_at: string };

const CLOSED_WO = new Set(["done", "completed", "closed"]);

export default function FleetInsights() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState("90");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [faultReports, setFaultReports] = useState<FaultReport[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);

  const sinceISO = useMemo(() => new Date(Date.now() - Number(rangeDays) * 86400000).toISOString(), [rangeDays]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: wo }, { data: sl }, { data: inv }, { data: t }, { data: fr }, { data: templates }] = await Promise.all([
        supabase.from("machines").select("id, name, plate_number, current_odometer_km"),
        supabase.from("work_orders").select("id, machine_id, status, created_at, completed_at, labor_cost").gte("created_at", sinceISO),
        supabase.from("service_logs").select("id, machine_id, cost, performed_at").gte("performed_at", sinceISO.slice(0, 10)),
        supabase.from("inventory_items").select("id, category, order_status"),
        supabase.from("trips").select("machine_id, start_odo, end_odo, status").eq("status", "completed"),
        supabase.from("fault_reports").select("machine_id, created_at, description").gte("created_at", sinceISO),
        supabase.from("checklist_templates").select("id").eq("is_fleet_pre_start", true),
      ]);
      setMachines((m ?? []) as Machine[]);
      setWorkOrders((wo ?? []) as WorkOrder[]);
      setServiceLogs((sl ?? []) as ServiceLog[]);
      setInventoryItems((inv ?? []) as InventoryItem[]);
      setTrips((t ?? []) as Trip[]);
      setFaultReports((fr ?? []) as FaultReport[]);

      const logIds = (sl ?? []).map((s: any) => s.id);
      if (logIds.length > 0) {
        const { data: sp } = await supabase.from("service_parts").select("id, service_log_id, quantity, unit_cost, part_name, inventory_item_id").in("service_log_id", logIds);
        setServiceParts((sp ?? []) as ServicePart[]);
      } else {
        setServiceParts([]);
      }

      const templateIds = (templates ?? []).map((t: any) => t.id);
      if (templateIds.length > 0) {
        const { data: ex } = await supabase.from("checklist_executions").select("machine_id, performed_at").in("template_id", templateIds).gte("performed_at", sinceISO);
        setExecutions((ex ?? []) as Execution[]);
      } else {
        setExecutions([]);
      }

      setLoading(false);
    })();
  }, [profile, sinceISO]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const vehicleLabel = (id: string) => {
    const m = machineMap.get(id);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const scoped = <T extends { machine_id: string }>(rows: T[]) =>
    vehicleFilter === "all" ? rows : rows.filter((r) => r.machine_id === vehicleFilter);

  const woScoped = useMemo(() => scoped(workOrders), [workOrders, vehicleFilter]);
  const slScoped = useMemo(() => scoped(serviceLogs), [serviceLogs, vehicleFilter]);
  const tripsScoped = useMemo(() => scoped(trips), [trips, vehicleFilter]);
  const frScoped = useMemo(() => scoped(faultReports), [faultReports, vehicleFilter]);
  const exScoped = useMemo(() => scoped(executions), [executions, vehicleFilter]);
  const inventoryMap = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i.category])), [inventoryItems]);

  // --- Downtime: WO created -> completed (or now, if still open), in hours ---
  const downtimeByMachine = useMemo(() => {
    const map = new Map<string, { hours: number; count: number }>();
    for (const w of woScoped) {
      const start = new Date(w.created_at).getTime();
      const end = w.completed_at ? new Date(w.completed_at).getTime() : Date.now();
      const hours = Math.max(0, (end - start) / 3600000);
      const acc = map.get(w.machine_id) ?? { hours: 0, count: 0 };
      acc.hours += hours;
      acc.count += 1;
      map.set(w.machine_id, acc);
    }
    return map;
  }, [woScoped]);
  const totalDowntimeHrs = useMemo(() => Array.from(downtimeByMachine.values()).reduce((s, v) => s + v.hours, 0), [downtimeByMachine]);
  const closedWOs = useMemo(() => woScoped.filter((w) => CLOSED_WO.has(w.status) && w.completed_at), [woScoped]);
  const avgRepairHrs = useMemo(() => {
    if (closedWOs.length === 0) return 0;
    const total = closedWOs.reduce((s, w) => s + (new Date(w.completed_at!).getTime() - new Date(w.created_at).getTime()) / 3600000, 0);
    return total / closedWOs.length;
  }, [closedWOs]);

  // --- Breakdown rate: fault reports per vehicle over the period ---
  const activeVehicleCount = vehicleFilter === "all" ? Math.max(1, machines.length) : 1;
  const breakdownRate = frScoped.length / activeVehicleCount;

  // --- MTBF: mean days between fault reports, per vehicle ---
  const mtbfByMachine = useMemo(() => {
    const byMachine = new Map<string, number[]>();
    for (const f of frScoped) {
      const arr = byMachine.get(f.machine_id) ?? [];
      arr.push(new Date(f.created_at).getTime());
      byMachine.set(f.machine_id, arr);
    }
    const rows: { machineId: string; mtbfDays: number | null; count: number }[] = [];
    for (const [machineId, times] of byMachine) {
      times.sort((a, b) => a - b);
      if (times.length < 2) { rows.push({ machineId, mtbfDays: null, count: times.length }); continue; }
      const gaps = times.slice(1).map((t, i) => (t - times[i]) / 86400000);
      rows.push({ machineId, mtbfDays: gaps.reduce((s, g) => s + g, 0) / gaps.length, count: times.length });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [frScoped]);

  // --- Repeated repairs: same vehicle + same fault keyword 3+ times in period ---
  const repeatedRepairs = useMemo(() => {
    const key = (f: FaultReport) => `${f.machine_id}::${f.description.trim().toLowerCase().slice(0, 40)}`;
    const counts = new Map<string, { machineId: string; text: string; count: number }>();
    for (const f of frScoped) {
      const k = key(f);
      const acc = counts.get(k) ?? { machineId: f.machine_id, text: f.description.slice(0, 60), count: 0 };
      acc.count += 1;
      counts.set(k, acc);
    }
    return Array.from(counts.values()).filter((r) => r.count >= 3).sort((a, b) => b.count - a.count);
  }, [frScoped]);

  // --- Cost per km: (labor_cost + service_log cost) / km travelled ---
  const kmByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tripsScoped) {
      if (t.start_odo == null || t.end_odo == null) continue;
      const km = t.end_odo - t.start_odo;
      if (km <= 0) continue;
      map.set(t.machine_id, (map.get(t.machine_id) ?? 0) + km);
    }
    return map;
  }, [tripsScoped]);

  const costByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of woScoped) map.set(w.machine_id, (map.get(w.machine_id) ?? 0) + Number(w.labor_cost ?? 0));
    for (const s of slScoped) map.set(s.machine_id, (map.get(s.machine_id) ?? 0) + Number(s.cost ?? 0));
    return map;
  }, [woScoped, slScoped]);

  const costPerKmRows = useMemo(() => {
    const ids = new Set([...kmByMachine.keys(), ...costByMachine.keys()]);
    return Array.from(ids)
      .map((id) => {
        const km = kmByMachine.get(id) ?? 0;
        const cost = costByMachine.get(id) ?? 0;
        return { machineId: id, label: vehicleLabel(id), km, cost, perKm: km > 0 ? cost / km : null };
      })
      .filter((r) => r.km > 0)
      .sort((a, b) => (b.perKm ?? 0) - (a.perKm ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmByMachine, costByMachine, machines]);

  const fleetKm = Array.from(kmByMachine.values()).reduce((s, v) => s + v, 0);
  const fleetCost = Array.from(costByMachine.values()).reduce((s, v) => s + v, 0);
  const fleetCostPerKm = fleetKm > 0 ? fleetCost / fleetKm : null;

  // --- Labour cost by vehicle ---
  const labourByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of woScoped) map.set(w.machine_id, (map.get(w.machine_id) ?? 0) + Number(w.labor_cost ?? 0));
    return Array.from(map.entries()).map(([id, cost]) => ({ machineId: id, label: vehicleLabel(id), cost })).sort((a, b) => b.cost - a.cost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woScoped, machines]);
  const totalLabourCost = labourByMachine.reduce((s, r) => s + r.cost, 0);

  // --- Oil consumption: service_parts linked to inventory_items with category 'oil' ---
  const logMachineMap = useMemo(() => new Map(slScoped.map((s) => [s.id, s.machine_id])), [slScoped]);
  const oilByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of serviceParts) {
      const category = (p.inventory_item_id && inventoryMap.get(p.inventory_item_id)) || "";
      if (category.toLowerCase() !== "oil") continue;
      const machineId = logMachineMap.get(p.service_log_id);
      if (!machineId) continue;
      map.set(machineId, (map.get(machineId) ?? 0) + Number(p.quantity ?? 0));
    }
    return Array.from(map.entries()).map(([id, qty]) => ({ machineId: id, label: vehicleLabel(id), qty })).sort((a, b) => b.qty - a.qty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceParts, inventoryMap, logMachineMap, machines]);

  // --- Spare part consumption trend: top parts by total cost in period ---
  const partConsumption = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; cost: number }>();
    for (const p of serviceParts) {
      const acc = map.get(p.part_name) ?? { name: p.part_name, qty: 0, cost: 0 };
      acc.qty += Number(p.quantity ?? 0);
      acc.cost += Number(p.quantity ?? 0) * Number(p.unit_cost ?? 0);
      map.set(p.part_name, acc);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost).slice(0, 8);
  }, [serviceParts]);

  // --- Parts availability: % of stocked parts not currently stuck in an ordering delay ---
  const partsAvailability = useMemo(() => {
    if (inventoryItems.length === 0) return null;
    const inStock = inventoryItems.filter((i) => !i.order_status || ["none", "received"].includes(i.order_status)).length;
    return (inStock / inventoryItems.length) * 100;
  }, [inventoryItems]);

  // --- Pre-start inspection completion rate: submitted vs expected (1/vehicle/day) ---
  const inspectionCompletionRate = useMemo(() => {
    const vehicleCount = vehicleFilter === "all" ? machines.length : 1;
    if (vehicleCount === 0) return null;
    const days = Number(rangeDays);
    const expected = vehicleCount * days;
    return expected > 0 ? Math.min(100, (exScoped.length / expected) * 100) : null;
  }, [exScoped, machines.length, vehicleFilter, rangeDays]);

  // --- Fault reports trend, weekly buckets ---
  const faultTrend = useMemo(() => {
    const weeks = Math.ceil(Number(rangeDays) / 7);
    const buckets: { label: string; count: number }[] = [];
    const now = Date.now();
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 86400000;
      const weekEnd = now - i * 7 * 86400000;
      const count = frScoped.filter((f) => {
        const t = new Date(f.created_at).getTime();
        return t >= weekStart && t < weekEnd;
      }).length;
      buckets.push({ label: `W-${i}`, count });
    }
    return buckets;
  }, [frScoped, rangeDays]);

  const downtimeChartData = useMemo(
    () => Array.from(downtimeByMachine.entries()).map(([id, v]) => ({ label: vehicleLabel(id), hours: Math.round(v.hours) })).sort((a, b) => b.hours - a.hours).slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [downtimeByMachine, machines],
  );

  if (loading) return <PageLoader />;

  const kpis = [
    { label: "Fleet downtime", value: `${formatNumber(Math.round(totalDowntimeHrs))} hrs`, sub: `${woScoped.length} work orders`, icon: Wrench },
    { label: "Avg repair time", value: closedWOs.length > 0 ? `${avgRepairHrs.toFixed(1)} hrs` : "—", sub: `${closedWOs.length} closed`, icon: Wrench },
    { label: "Breakdown rate", value: breakdownRate.toFixed(2), sub: "fault reports / vehicle", icon: AlertTriangle },
    { label: "Cost per km", value: fleetCostPerKm != null ? formatMoney(Math.round(fleetCostPerKm)) : "—", sub: `${formatNumber(Math.round(fleetKm))} km travelled`, icon: Gauge },
    { label: "Inspection completion", value: inspectionCompletionRate != null ? `${inspectionCompletionRate.toFixed(0)}%` : "—", sub: "pre-start inspections", icon: ClipboardCheck },
    { label: "Parts availability", value: partsAvailability != null ? `${partsAvailability.toFixed(0)}%` : "—", sub: "in stock, no ordering delay", icon: Package },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet KPIs & Analytics</h1>
          <p className="text-sm text-muted-foreground">Downtime, reliability, cost and inspection performance across your fleet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.plate_number ? `${m.name} (${m.plate_number})` : m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Downtime by vehicle (hrs)</h2>
          {downtimeChartData.length === 0 ? (
            <EmptyState icon={<Wrench className="h-5 w-5" />} title="No downtime data" description="Work orders in this period will show up here." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" name="Downtime (hrs)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Fault reports trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={faultTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Fault reports" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Vehicle reliability (MTBF)</h2>
          {mtbfByMachine.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No fault reports" description="Reliability metrics need at least one fault report." />
          ) : (
            <div className="space-y-2">
              {mtbfByMachine.slice(0, 8).map((r) => (
                <div key={r.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{vehicleLabel(r.machineId)}</span>
                  <span className="text-muted-foreground">
                    {r.mtbfDays != null ? `${r.mtbfDays.toFixed(1)} days between faults` : `${r.count} fault report(s)`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Cost per km leaderboard</h2>
          {costPerKmRows.length === 0 ? (
            <EmptyState icon={<Gauge className="h-5 w-5" />} title="No data yet" description="Close trips with odometer readings and log maintenance costs to see this." />
          ) : (
            <div className="space-y-2">
              {costPerKmRows.slice(0, 8).map((r) => (
                <div key={r.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">{r.perKm != null ? `${formatMoney(Math.round(r.perKm))}/km` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Repeated repairs</h2>
            <span className="text-xs text-muted-foreground">3+ times in period</span>
          </div>
          {repeatedRepairs.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No repeated repairs" description="Vehicles with the same recurring fault will show up here." />
          ) : (
            <div className="space-y-2">
              {repeatedRepairs.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{vehicleLabel(r.machineId)}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.text}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">{r.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Labour cost by vehicle</h2>
            <span className="text-xs text-muted-foreground">Total {formatMoney(Math.round(totalLabourCost))}</span>
          </div>
          {labourByMachine.length === 0 ? (
            <EmptyState icon={<Wrench className="h-5 w-5" />} title="No labour cost logged" description="Add labour cost on work orders to see this." />
          ) : (
            <div className="space-y-2">
              {labourByMachine.slice(0, 8).map((r) => (
                <div key={r.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">{formatMoney(Math.round(r.cost))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Spare part consumption</h2>
          {partConsumption.length === 0 ? (
            <EmptyState icon={<Package className="h-5 w-5" />} title="No parts consumed" description="Parts used on service logs in this period will show up here." />
          ) : (
            <div className="space-y-2">
              {partConsumption.map((p) => (
                <div key={p.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{formatNumber(p.qty)} used · {formatMoney(Math.round(p.cost))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Oil consumption by vehicle</h2>
          {oilByMachine.length === 0 ? (
            <EmptyState icon={<Fuel className="h-5 w-5" />} title="No oil usage logged" description="Tag inventory items as category 'oil' to track this." />
          ) : (
            <div className="space-y-2">
              {oilByMachine.slice(0, 8).map((r) => (
                <div key={r.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">{formatNumber(r.qty)} units</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
