import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Route,
  Fuel,
  FileWarning,
  MapPin,
  Wrench,
  Gauge,
  CircleDot,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState, PageLoader } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { scheduleStatus } from "@/lib/machine-constants";
import { tyreStatus, normalizeTyrePosition } from "@/lib/fleet-constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { formatWoNumber } from "@/components/WorkOrderPreview";
import { formatDistanceToNow } from "date-fns";
import { useI18n } from "@/i18n/I18nProvider";

const toneClasses: Record<string, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_38%)]",
  destructive: "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]",
};

const OPEN_WO_STATUSES = new Set(["open", "assigned", "in_progress", "waiting_parts"]);

type ExpiryRow = { key: string; typeLabel: string; holderLabel: string; expiresOn: string };
type MachineRow = { id: string; name: string; plate_number: string | null; status: string; current_odometer_km: number | null };
type TripRow = { id: string; machine_id: string; driver_id: string | null; status: string; start_at: string | null; end_at: string | null; start_odo: number | null; end_odo: number | null; fuel_used_l: number | null };
type FuelLogRow = { machine_id: string; recorded_at: string; fuel_cost: number | null };
type TyreRow = { id: string; machine_id: string; position: string; brand: string | null; target_replace_km: number | null; fitted_odo: number | null; removed_at: string | null };
type ScheduleRow = { machine_id: string; next_due_date: string | null };
type DriverRow = { id: string; full_name: string; licence_expiry: string | null; medical_expiry: string | null };
type WorkOrderRow = { id: string; machine_id: string; status: string; title: string; wo_number: number | null; wo_year: number | null; priority: string };
type FaultReportRow = { id: string; machine_id: string; reporter_name: string; description: string; status: string; created_at: string };

type EfficiencyRow = { machineId: string; label: string; km: number; litres: number; kmPerL: number };
type TyreAlertRow = { key: string; label: string; status: "due_soon" | "overdue" };
type OpenWoGroup = { machineId: string; label: string; count: number; highestPriority: string };

export default function FleetDashboard() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState<ExpiryRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogRow[]>([]);
  const [tyres, setTyres] = useState<TyreRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [openWorkOrders, setOpenWorkOrders] = useState<WorkOrderRow[]>([]);
  const [recentFaults, setRecentFaults] = useState<FaultReportRow[]>([]);
  const [inspectionsToday, setInspectionsToday] = useState<{ machine_id: string }[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const todayStartISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [
        { data: docs },
        { data: m },
        { data: driverRows },
        { data: t },
        { data: fl },
        { data: ty },
        { data: sched },
        { data: wo },
        { data: fr },
        { data: fleetTemplates },
      ] = await Promise.all([
        supabase.from("vehicle_documents").select("id, machine_id, doc_type, expires_on").not("expires_on", "is", null),
        supabase.from("machines").select("id, name, plate_number, status, current_odometer_km"),
        supabase.from("drivers").select("id, full_name, licence_expiry, medical_expiry").eq("status", "active"),
        supabase.from("trips").select("id, machine_id, driver_id, status, start_at, end_at, start_odo, end_odo, fuel_used_l"),
        supabase.from("fuel_logs").select("machine_id, recorded_at, fuel_cost"),
        supabase.from("tyres").select("id, machine_id, position, brand, target_replace_km, fitted_odo, removed_at").is("removed_at", null),
        supabase.from("service_schedules").select("machine_id, next_due_date"),
        supabase.from("work_orders").select("id, machine_id, status, title, wo_number, wo_year, priority").in("status", Array.from(OPEN_WO_STATUSES)),
        supabase.from("fault_reports").select("id, machine_id, reporter_name, description, status, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("checklist_templates").select("id").eq("is_fleet_pre_start", true),
      ]);

      const templateIds = (fleetTemplates ?? []).map((t: any) => t.id);
      let todaysInspections: { machine_id: string }[] = [];
      if (templateIds.length > 0) {
        const { data: ex } = await supabase
          .from("checklist_executions")
          .select("machine_id")
          .in("template_id", templateIds)
          .gte("performed_at", todayStartISO);
        todaysInspections = (ex ?? []) as { machine_id: string }[];
      }

      type DocRow = { id: string; machine_id: string; doc_type: string; expires_on: string };

      const machineList = (m ?? []) as MachineRow[];
      const machineMap = new Map(machineList.map((mm) => [mm.id, mm]));
      const rows: ExpiryRow[] = [];
      for (const d of (docs ?? []) as DocRow[]) {
        const mm = machineMap.get(d.machine_id);
        const label = mm ? (mm.plate_number ? `${mm.name} (${mm.plate_number})` : mm.name) : "Vehicle";
        rows.push({ key: `doc-${d.id}`, typeLabel: d.doc_type, holderLabel: label, expiresOn: d.expires_on });
      }
      for (const dr of (driverRows ?? []) as DriverRow[]) {
        if (dr.licence_expiry) rows.push({ key: `dl-${dr.id}`, typeLabel: "Driving licence", holderLabel: dr.full_name, expiresOn: dr.licence_expiry });
        if (dr.medical_expiry) rows.push({ key: `dm-${dr.id}`, typeLabel: "Medical certificate", holderLabel: dr.full_name, expiresOn: dr.medical_expiry });
      }
      rows.sort((a, b) => new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime());

      setExpiring(rows);
      setMachines(machineList);
      setTrips((t ?? []) as TripRow[]);
      setFuelLogs((fl ?? []) as FuelLogRow[]);
      setTyres((ty ?? []) as TyreRow[]);
      setSchedules((sched ?? []) as ScheduleRow[]);
      setDrivers((driverRows ?? []) as DriverRow[]);
      setOpenWorkOrders((wo ?? []) as WorkOrderRow[]);
      setRecentFaults((fr ?? []) as FaultReportRow[]);
      setInspectionsToday(todaysInspections);
      setLoading(false);
    })();
  }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.name} (${m.plate_number})` : m.name;
  };

  const expiringWithin30 = useMemo(() => expiring.filter((r) => scheduleStatus(r.expiresOn) !== "ok"), [expiring]);
  const expiringWithin7 = useMemo(
    () => expiringWithin30.filter((r) => (new Date(r.expiresOn).getTime() - Date.now()) / 86400000 <= 7),
    [expiringWithin30],
  );

  const isToday = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const onRoadMachineIds = useMemo(
    () => new Set(trips.filter((t) => t.status === "in_progress").map((t) => t.machine_id)),
    [trips],
  );
  const activeMachines = useMemo(() => machines.filter((m) => m.status === "active"), [machines]);
  const availabilityPct = activeMachines.length > 0 ? Math.round((onRoadMachineIds.size / activeMachines.length) * 100) : 0;

  const tripsInProgressToday = trips.filter((t) => t.status === "in_progress").length;
  const tripsCompletedToday = trips.filter((t) => t.status === "completed" && isToday(t.end_at)).length;

  const weekAgo = Date.now() - 7 * 86400000;
  const twoWeeksAgo = Date.now() - 14 * 86400000;
  const fuelCostThisWeek = fuelLogs.filter((f) => new Date(f.recorded_at).getTime() >= weekAgo).reduce((sum, f) => sum + Number(f.fuel_cost ?? 0), 0);
  const fuelCostLastWeek = fuelLogs
    .filter((f) => new Date(f.recorded_at).getTime() >= twoWeeksAgo && new Date(f.recorded_at).getTime() < weekAgo)
    .reduce((sum, f) => sum + Number(f.fuel_cost ?? 0), 0);
  const fuelDeltaLabel = fuelCostLastWeek > 0
    ? `${fuelCostThisWeek >= fuelCostLastWeek ? "+" : ""}${Math.round(((fuelCostThisWeek - fuelCostLastWeek) / fuelCostLastWeek) * 100)}% vs. last week`
    : "vs. last week";

  const efficiency = useMemo<EfficiencyRow[]>(() => {
    const byMachine = new Map<string, { km: number; litres: number }>();
    for (const t of trips) {
      if (t.status !== "completed" || t.start_odo == null || t.end_odo == null || !t.fuel_used_l) continue;
      const km = t.end_odo - t.start_odo;
      if (km <= 0) continue;
      const acc = byMachine.get(t.machine_id) ?? { km: 0, litres: 0 };
      acc.km += km;
      acc.litres += t.fuel_used_l;
      byMachine.set(t.machine_id, acc);
    }
    return Array.from(byMachine.entries())
      .map(([machineId, v]) => ({ machineId, label: vehicleLabel(machineId), km: v.km, litres: v.litres, kmPerL: v.litres > 0 ? v.km / v.litres : 0 }))
      .sort((a, b) => b.kmPerL - a.kmPerL)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, machines]);

  const tyreAlerts = useMemo<TyreAlertRow[]>(() => {
    const rows: TyreAlertRow[] = [];
    for (const ty of tyres) {
      const status = tyreStatus(ty, machineMap.get(ty.machine_id)?.current_odometer_km ?? null);
      if (status === "ok") continue;
      rows.push({ key: ty.id, label: `${vehicleLabel(ty.machine_id)} · ${normalizeTyrePosition(ty.position)}${ty.brand ? ` (${ty.brand})` : ""}`, status });
    }
    return rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "overdue" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tyres, machines]);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d.full_name])), [drivers]);

  // Current driver per vehicle: driver on the latest in_progress trip, else the most recent trip's driver.
  const currentDriverByMachine = useMemo(() => {
    const map = new Map<string, { name: string; onTrip: boolean }>();
    const sorted = [...trips].sort((a, b) => new Date(b.start_at ?? 0).getTime() - new Date(a.start_at ?? 0).getTime());
    for (const t of sorted) {
      if (map.has(t.machine_id) || !t.driver_id) continue;
      map.set(t.machine_id, { name: driverMap.get(t.driver_id) ?? "—", onTrip: t.status === "in_progress" });
    }
    return map;
  }, [trips, driverMap]);

  const nextDueByMachine = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (!s.next_due_date) continue;
      const existing = map.get(s.machine_id);
      if (!existing || new Date(s.next_due_date) < new Date(existing)) map.set(s.machine_id, s.next_due_date);
    }
    return map;
  }, [schedules]);

  const openWoGroups = useMemo<OpenWoGroup[]>(() => {
    const priorityRank: Record<string, number> = { critical: 3, high: 2, normal: 1, low: 0 };
    const map = new Map<string, { count: number; highestPriority: string }>();
    for (const w of openWorkOrders) {
      const acc = map.get(w.machine_id) ?? { count: 0, highestPriority: "low" };
      acc.count += 1;
      if ((priorityRank[w.priority] ?? 0) > (priorityRank[acc.highestPriority] ?? 0)) acc.highestPriority = w.priority;
      map.set(w.machine_id, acc);
    }
    return Array.from(map.entries())
      .map(([machineId, v]) => ({ machineId, label: vehicleLabel(machineId), count: v.count, highestPriority: v.highestPriority }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWorkOrders, machines]);

  const inspectionRateToday = useMemo(() => {
    if (activeMachines.length === 0) return null;
    const inspectedIds = new Set(inspectionsToday.map((r) => r.machine_id));
    const inspectedActive = activeMachines.filter((m) => inspectedIds.has(m.id)).length;
    return { pct: Math.round((inspectedActive / activeMachines.length) * 100), inspected: inspectedActive, total: activeMachines.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionsToday, activeMachines]);

  const kpiCards = [
    {
      label: t.fleet.vehiclesOnRoad,
      value: loading ? "—" : String(onRoadMachineIds.size),
      sub: loading ? "" : `${onRoadMachineIds.size} / ${activeMachines.length} active · ${availabilityPct}% availability`,
      icon: Truck,
      tone: "default",
    },
    {
      label: t.fleet.tripsToday,
      value: loading ? "—" : String(tripsInProgressToday + tripsCompletedToday),
      sub: loading ? "" : `${tripsInProgressToday} in progress / ${tripsCompletedToday} completed`,
      icon: Route,
      tone: "success",
    },
    {
      label: t.fleet.fuelCostWeek,
      value: loading ? "—" : formatMoney(fuelCostThisWeek),
      sub: fuelDeltaLabel,
      icon: Fuel,
      tone: "warning",
    },
    {
      label: t.fleet.docsExpiring30,
      value: loading ? "—" : String(expiringWithin30.length),
      sub: loading ? "" : `${expiringWithin7.length} expiring within 7 days`,
      icon: FileWarning,
      tone: "destructive",
    },
  ] as const;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.dashboardTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {t.fleet.dashboardSub}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.expiringDocuments}</h2>
            </div>
            <Link to="/fleet/documents" className="text-xs font-medium text-primary hover:underline">
              {t.fleet.viewAll}
            </Link>
          </div>
          {expiringWithin30.length === 0 ? (
            <EmptyState
              icon={<FileWarning className="h-5 w-5" />}
              title="Nothing expiring soon"
              description="Vehicle documents and driver licences due within 30 days will show up here."
            />
          ) : (
            <div className="space-y-2">
              {expiringWithin30.slice(0, 6).map((r) => (
                <div key={r.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium capitalize">{r.typeLabel.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{r.holderLabel}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(r.expiresOn)}</span>
                    <StatusBadge status={scheduleStatus(r.expiresOn)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">{t.fleet.fuelEfficiencyLeaderboard}</h2>
          </div>
          {efficiency.length === 0 ? (
            <EmptyState
              icon={<Gauge className="h-5 w-5" />}
              title="No data yet"
              description="Close trips with fuel used and odometer readings to see km/L rankings."
            />
          ) : (
            <div className="space-y-2">
              {efficiency.map((e, i) => (
                <div key={e.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{i + 1}</span>
                    <span className="font-medium">{e.label}</span>
                  </div>
                  <span className="text-muted-foreground">{formatNumber(e.kmPerL)} km/L</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.tyreAlerts}</h2>
            </div>
            <Link to="/fleet/tyres" className="text-xs font-medium text-primary hover:underline">
              {t.fleet.viewAll}
            </Link>
          </div>
          {tyreAlerts.length === 0 ? (
            <EmptyState
              icon={<CircleDot className="h-5 w-5" />}
              title="No tyre alerts"
              description="Tyres past their target replacement distance will show up here."
            />
          ) : (
            <div className="space-y-2">
              {tyreAlerts.slice(0, 6).map((a) => (
                <div key={a.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{a.label}</span>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.statusBoard}</h2>
            </div>
            <Link to="/fleet/vehicles" className="text-xs font-medium text-primary hover:underline">
              {t.fleet.viewAll}
            </Link>
          </div>
          {machines.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="No vehicles yet"
              description="Add vehicles to see plate, driver, odometer and next service at a glance."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Vehicle</th>
                    <th className="py-2 pr-3 font-medium">Driver</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Odometer</th>
                    <th className="py-2 pr-3 font-medium">Next service</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.slice(0, 8).map((m) => {
                    const driver = currentDriverByMachine.get(m.id);
                    const nextDue = nextDueByMachine.get(m.id) ?? null;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-2 pr-3">
                          <Link to={`/machines/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                          {m.plate_number && <span className="ml-1.5 text-xs text-muted-foreground">{m.plate_number}</span>}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {driver ? (<>{driver.name}{driver.onTrip && <span className="ml-1.5 text-xs text-primary">· on trip</span>}</>) : "—"}
                        </td>
                        <td className="py-2 pr-3"><StatusBadge status={m.status} /></td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatNumber(m.current_odometer_km)} km</td>
                        <td className="py-2 pr-3">{nextDue ? <StatusBadge status={scheduleStatus(nextDue)} /> : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {machines.length > 8 && (
                <div className="mt-2 text-xs text-muted-foreground">+{machines.length - 8} more vehicles</div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.openWOsByVehicle}</h2>
            </div>
            <Link to="/work-orders" className="text-xs font-medium text-primary hover:underline">
              {t.fleet.viewAll}
            </Link>
          </div>
          {openWoGroups.length === 0 ? (
            <EmptyState
              icon={<Wrench className="h-5 w-5" />}
              title="No open work orders"
              description="Open, assigned and in-progress work orders will be grouped by vehicle here."
            />
          ) : (
            <div className="space-y-2">
              {openWoGroups.map((g) => (
                <div key={g.machineId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{g.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={
                      g.highestPriority === "critical" ? "text-xs font-medium text-red-600" :
                      g.highestPriority === "high" ? "text-xs font-medium text-amber-600" :
                      "text-xs text-muted-foreground"
                    }>{g.highestPriority}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{g.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.recentFaultReports}</h2>
            </div>
            <Link to="/fault-reports" className="text-xs font-medium text-primary hover:underline">
              {t.fleet.viewAll}
            </Link>
          </div>
          {recentFaults.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-5 w-5" />}
              title="No fault reports"
              description="Faults reported from the QR scan page or manually will show up here."
            />
          ) : (
            <div className="space-y-2">
              {recentFaults.map((f) => (
                <div key={f.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{vehicleLabel(f.machine_id)}</span>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{f.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">{t.fleet.inspectionCompletionRate}</h2>
          </div>
          {inspectionRateToday === null ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="No active vehicles"
              description="Completion rate compares today's submitted pre-start inspections to active vehicles."
            />
          ) : (
            <div>
              <div className="text-3xl font-semibold tracking-tight">{inspectionRateToday.pct}%</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {inspectionRateToday.inspected} of {inspectionRateToday.total} active vehicles inspected today
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${inspectionRateToday.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
