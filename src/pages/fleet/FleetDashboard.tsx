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
  Radio,
  RefreshCw,
  Activity,
  ArrowUpRight,
  Navigation,
  Search,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parseMachine, SAFE_MACHINE_COLUMNS, normalizeTelematicsStatus, type FleetVehicle, type TelematicsStatus } from "@/lib/fleet-metadata";
import { syncTrakzeeFleet } from "@/services/trakzeeService";
import { computeOdoPmStatus } from "@/services/fleetPmService";

const toneClasses: Record<string, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_38%)]",
  destructive: "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]",
};

const OPEN_WO_STATUSES = new Set(["open", "assigned", "in_progress", "waiting_parts"]);

type ExpiryRow = { key: string; typeLabel: string; holderLabel: string; expiresOn: string };
type MachineRow = FleetVehicle;
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
  const { user, profile, organisation } = useAuth();
  const { t } = useI18n();

  const companyDisplayName =
    (organisation?.name && organisation.name !== "MachineCare" && organisation.name !== "My Company")
      ? organisation.name
      : user?.user_metadata?.company_name ||
        user?.user_metadata?.organisation_name ||
        organisation?.name ||
        "Company";
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

  const [syncingGps, setSyncingGps] = useState(false);
  const [showAllStatusBoard, setShowAllStatusBoard] = useState(false);
  const [statusBoardSearch, setStatusBoardSearch] = useState("");
  const [statusBoardStatusFilter, setStatusBoardStatusFilter] = useState<"all" | TelematicsStatus>("all");

  const handleQuickSync = async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    setSyncingGps(true);
    const res = await syncTrakzeeFleet(orgId, true);
    setSyncingGps(false);
    if (!res.success) {
      toast.error(res.error || "Failed to sync Trakzee GPS");
    } else {
      toast.success(`Trakzee GPS Synced: ${res.vehicles_updated} vehicle(s) updated`);
      load();
    }
  };

  const load = async () => {
    if (!profile) return;
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
      supabase.from("machines").select(SAFE_MACHINE_COLUMNS).in("category", ["Vehicle", "Trailer"]).order("name"),
      supabase.from("drivers").select("id, full_name, licence_expiry, medical_expiry").eq("status", "active"),
      supabase.from("trips").select("id, machine_id, driver_id, status, start_at, end_at, start_odo, end_odo, fuel_used_l"),
      supabase.from("fuel_logs").select("machine_id, recorded_at, fuel_cost"),
      supabase.from("tyres").select("id, machine_id, position, brand, target_replace_km, fitted_odo, removed_at").is("removed_at", null),
      supabase.from("service_schedules").select("machine_id, next_due_date, interval_hours, last_service_hours, next_due_hours, name, status"),
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

    const machineList = (m ?? []).map((raw, idx) => parseMachine(raw, idx));
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
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const handleVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [profile]);

  const machineMap = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const vehicleLabel = (machineId: string) => {
    const m = machineMap.get(machineId);
    if (!m) return "Vehicle";
    return m.plate_number ? `${m.plate_number} (${m.name})` : m.name;
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

  const runningVehicles = useMemo(() => {
    return machines.filter((m) => {
      const status = normalizeTelematicsStatus(
        m.telematics_status,
        m.telematics_speed,
        m.telematics_ignition,
        m.telematics_last_at,
        m.telematics_latitude != null && m.telematics_longitude != null
      );
      return status === "Running";
    });
  }, [machines]);

  const idleVehicles = useMemo(() => {
    return machines.filter((m) => {
      const status = normalizeTelematicsStatus(
        m.telematics_status,
        m.telematics_speed,
        m.telematics_ignition,
        m.telematics_last_at,
        m.telematics_latitude != null && m.telematics_longitude != null
      );
      return status === "Idle";
    });
  }, [machines]);

  const stoppedVehicles = useMemo(() => {
    return machines.filter((m) => {
      const status = normalizeTelematicsStatus(
        m.telematics_status,
        m.telematics_speed,
        m.telematics_ignition,
        m.telematics_last_at,
        m.telematics_latitude != null && m.telematics_longitude != null
      );
      return status === "Stopped";
    });
  }, [machines]);

  const inactiveVehicles = useMemo(() => {
    return machines.filter((m) => {
      const status = normalizeTelematicsStatus(
        m.telematics_status,
        m.telematics_speed,
        m.telematics_ignition,
        m.telematics_last_at,
        m.telematics_latitude != null && m.telematics_longitude != null
      );
      return status === "Inactive";
    });
  }, [machines]);

  const totalOdometerKm = useMemo(() => {
    return machines.reduce((acc, m) => acc + (Number(m.current_odometer_km) || 0), 0);
  }, [machines]);

  const onRoadMachineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of machines) {
      if (Number(m.telematics_speed || 0) > 0 || Boolean(m.telematics_ignition)) {
        ids.add(m.id);
      }
    }
    for (const t of trips) {
      if (t.status === "in_progress") ids.add(t.machine_id);
    }
    return ids;
  }, [machines, trips]);

  const inWorkshopCount = useMemo(() => {
    return new Set(openWorkOrders.map((w) => w.machine_id)).size;
  }, [openWorkOrders]);

  const activeMachines = useMemo(() => machines.filter((m) => m.status === "active" || m.status === "operational"), [machines]);
  const operationalCount = Math.max(machines.length - inWorkshopCount, 0);
  const availabilityPct = machines.length > 0 ? Math.round((operationalCount / machines.length) * 100) : 100;

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

  // Current driver per vehicle: prioritizes telematics driver name from Trakzee, else assigned driver, else active trip driver
  const currentDriverByMachine = useMemo(() => {
    const map = new Map<string, { name: string; onTrip: boolean }>();
    for (const m of machines) {
      if (m.telematics_driver_name) {
        map.set(m.id, {
          name: m.telematics_driver_name,
          onTrip: Number(m.telematics_speed || 0) > 0 || Boolean(m.telematics_ignition),
        });
      }
    }
    const driverByVehiclePlate = new Map<string, string>();
    for (const d of drivers) {
      if ((d as any).assigned_vehicle) {
        driverByVehiclePlate.set(String((d as any).assigned_vehicle).trim().toLowerCase(), d.full_name);
      }
    }
    for (const m of machines) {
      if (!map.has(m.id)) {
        const plateKey = (m.plate_number || m.name || "").trim().toLowerCase();
        if (plateKey && driverByVehiclePlate.has(plateKey)) {
          map.set(m.id, {
            name: driverByVehiclePlate.get(plateKey)!,
            onTrip: Number(m.telematics_speed || 0) > 0 || Boolean(m.telematics_ignition),
          });
        }
      }
    }
    const sorted = [...trips].sort((a, b) => new Date(b.start_at ?? 0).getTime() - new Date(a.start_at ?? 0).getTime());
    for (const t of sorted) {
      if (map.has(t.machine_id) || !t.driver_id) continue;
      map.set(t.machine_id, { name: driverMap.get(t.driver_id) ?? "—", onTrip: t.status === "in_progress" });
    }
    return map;
  }, [trips, driverMap, machines, drivers]);

  const nextDueByMachine = useMemo(() => {
    const map = new Map<string, { label: string; status: "ok" | "due_soon" | "overdue"; isOdo: boolean }>();
    for (const m of machines) {
      const vehicleScheds = schedules.filter((s) => s.machine_id === m.id);
      if (vehicleScheds.length === 0) continue;

      let worstStatus: "ok" | "due_soon" | "overdue" = "ok";
      let displayLabel = "—";
      let isOdo = false;

      for (const s of vehicleScheds) {
        if (Number(s.interval_hours || 0) >= 1000 || (m.current_odometer_km ?? 0) > 0) {
          const odo = computeOdoPmStatus(s, m.current_odometer_km);
          isOdo = true;
          if (odo.status === "overdue") {
            worstStatus = "overdue";
            displayLabel = odo.statusLabel;
            break;
          } else if (odo.status === "due_soon" && worstStatus !== "overdue") {
            worstStatus = "due_soon";
            displayLabel = odo.statusLabel;
          } else if (displayLabel === "—") {
            displayLabel = odo.statusLabel;
          }
        } else if (s.next_due_date) {
          const dateStatus = scheduleStatus(s.next_due_date);
          if (dateStatus === "overdue") {
            worstStatus = "overdue";
            displayLabel = `Overdue (${formatDate(s.next_due_date)})`;
          } else if (dateStatus === "due_soon" && worstStatus !== "overdue") {
            worstStatus = "due_soon";
            displayLabel = `Due ${formatDate(s.next_due_date)}`;
          } else if (displayLabel === "—") {
            displayLabel = formatDate(s.next_due_date);
          }
        }
      }
      map.set(m.id, { label: displayLabel, status: worstStatus, isOdo });
    }
    return map;
  }, [schedules, machines]);

  const statusBoardVehicles = useMemo(() => {
    return machines.filter((m) => {
      const speed = Number(m.telematics_speed || 0);
      const hasGps = m.telematics_latitude != null && m.telematics_longitude != null;
      const vStatus = normalizeTelematicsStatus(
        m.telematics_status,
        m.telematics_speed,
        m.telematics_ignition,
        m.telematics_last_at,
        hasGps
      );

      if (statusBoardStatusFilter !== "all" && vStatus !== statusBoardStatusFilter) {
        return false;
      }

      if (statusBoardSearch) {
        const q = statusBoardSearch.toLowerCase();
        const driver = currentDriverByMachine.get(m.id);
        const plate = (m.plate_number || "").toLowerCase();
        const name = (m.name || "").toLowerCase();
        const driverName = (driver?.name || "").toLowerCase();
        const location = (m.telematics_location || m.home_depot || "").toLowerCase();
        if (!plate.includes(q) && !name.includes(q) && !driverName.includes(q) && !location.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [machines, statusBoardStatusFilter, statusBoardSearch, currentDriverByMachine]);

  const displayedStatusVehicles = useMemo(() => {
    if (showAllStatusBoard) return statusBoardVehicles;
    return statusBoardVehicles.slice(0, 10);
  }, [statusBoardVehicles, showAllStatusBoard]);

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
      label: "Fleet Live Active",
      value: loading ? "—" : `${onRoadMachineIds.size} / ${machines.length}`,
      sub: loading ? "" : `${runningVehicles.length} Running · ${idleVehicles.length} Idle · ${stoppedVehicles.length} Stopped · ${inactiveVehicles.length} Inactive`,
      icon: Activity,
      tone: "default",
    },
    {
      label: "Total Fleet Distance",
      value: loading ? "—" : `${formatNumber(totalOdometerKm)} km`,
      sub: loading ? "" : `Cached live from ${machines.length} vehicle ECUs`,
      icon: Gauge,
      tone: "success",
    },
    {
      label: t.fleet.tripsToday,
      value: loading ? "—" : String(tripsInProgressToday + tripsCompletedToday),
      sub: loading ? "" : `${tripsInProgressToday} in progress / ${tripsCompletedToday} completed`,
      icon: Route,
      tone: "warning",
    },
    {
      label: t.fleet.fuelCostWeek,
      value: loading ? "—" : formatMoney(fuelCostThisWeek),
      sub: fuelDeltaLabel,
      icon: Fuel,
      tone: "destructive",
    },
  ] as const;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={companyDisplayName}
              className="h-12 w-12 rounded-xl object-contain border border-border bg-card p-1 shadow-sm shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg border border-border shadow-sm shrink-0">
              {companyDisplayName ? companyDisplayName.trim().charAt(0).toUpperCase() : "C"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {companyDisplayName ? `${companyDisplayName} — ${t.fleet.dashboardTitle}` : t.fleet.dashboardTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t.fleet.dashboardSub}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleQuickSync}
            disabled={syncingGps}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncingGps ? "animate-spin text-primary" : ""}`} />
            {syncingGps ? "Syncing GPS..." : "Sync GPS"}
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/fleet/live-map">
              <Navigation className="h-4 w-4 text-emerald-500" />
              Live Fleet Map
            </Link>
          </Button>
          <Button size="sm" asChild className="gap-2">
            <Link to="/live">
              <Radio className="h-4 w-4 animate-pulse text-amber-300" />
              TV Wallboard
            </Link>
          </Button>
        </div>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{t.fleet.statusBoard}</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {machines.length} Connected Vehicles
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showAllStatusBoard ? "secondary" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
                onClick={() => setShowAllStatusBoard(!showAllStatusBoard)}
              >
                {showAllStatusBoard ? "Show top 10" : `View all (${machines.length})`}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <Link to="/fleet/live-map">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Live GPS Map
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Status Filter & Live Search Toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "Running", "Idle", "Stopped", "Inactive"] as const).map((st) => {
                const count = st === "all"
                  ? machines.length
                  : st === "Running"
                  ? runningVehicles.length
                  : st === "Idle"
                  ? idleVehicles.length
                  : st === "Stopped"
                  ? stoppedVehicles.length
                  : inactiveVehicles.length;

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusBoardStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      statusBoardStatusFilter === st
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {st === "all" ? "All" : st} ({count})
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={statusBoardSearch}
                onChange={(e) => setStatusBoardSearch(e.target.value)}
                placeholder="Search plate, driver, location…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {machines.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="No vehicles yet"
              description="Add vehicles to see plate, driver, odometer and next service at a glance."
            />
          ) : displayedStatusVehicles.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No matching vehicles"
              description="Try adjusting your status filter or search term."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusBoardSearch("");
                    setStatusBoardStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Vehicle / Plate</th>
                    <th className="py-2 pr-3 font-medium">Live Motion</th>
                    <th className="py-2 pr-3 font-medium">Driver</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Cached Odometer</th>
                    <th className="py-2 pr-3 font-medium">Next service</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStatusVehicles.map((m) => {
                    const driver = currentDriverByMachine.get(m.id);
                    const nextDue = nextDueByMachine.get(m.id) ?? null;
                    const speed = Number(m.telematics_speed || 0);
                    const hasGps = m.telematics_latitude != null && m.telematics_longitude != null;
                    const vStatus = normalizeTelematicsStatus(
                      m.telematics_status,
                      m.telematics_speed,
                      m.telematics_ignition,
                      m.telematics_last_at,
                      hasGps
                    );
                    return (
                      <tr key={m.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-3">
                          <Link to={`/fleet/vehicles/${m.id}`} className="font-semibold text-foreground hover:underline">
                            {m.plate_number || m.name}
                          </Link>
                          {m.plate_number && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{m.name}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          {vStatus === "Running" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Running ({speed > 0 ? `${speed} km/h` : "Moving"})
                            </span>
                          ) : vStatus === "Idle" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Idle (Key ON)
                            </span>
                          ) : vStatus === "Inactive" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Inactive (Offline)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              Stopped (Off)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-sm">
                          {driver ? (
                            <div className="font-medium text-foreground">
                              {driver.name}
                              {driver.onTrip && <span className="ml-1 text-xs text-emerald-600">· active</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground max-w-[220px] truncate" title={m.telematics_location || m.home_depot || ""}>
                          {m.telematics_location || m.home_depot || "—"}
                        </td>
                        <td className="py-2.5 pr-3 font-mono font-medium text-foreground">
                          {m.current_odometer_km ? `${formatNumber(m.current_odometer_km)} km` : "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          {nextDue ? (
                            <span
                              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                nextDue.status === "overdue"
                                  ? "text-red-600 bg-red-500/10 border-red-500/20"
                                  : nextDue.status === "due_soon"
                                  ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
                                  : "text-muted-foreground bg-muted/60 border-border"
                              }`}
                            >
                              {nextDue.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <span>
                  Showing {displayedStatusVehicles.length} of {statusBoardVehicles.length} vehicles
                  {statusBoardVehicles.length !== machines.length && ` (filtered from ${machines.length})`}
                </span>
                <div className="flex items-center gap-3">
                  {machines.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllStatusBoard(!showAllStatusBoard)}
                      className="font-medium text-primary hover:underline cursor-pointer"
                    >
                      {showAllStatusBoard ? "Collapse to top 10" : `View all ${machines.length} vehicles in board →`}
                    </button>
                  )}
                  <span className="text-border">|</span>
                  <Link to="/fleet/vehicles?view=live" className="font-medium text-primary hover:underline">
                    Open in Fleet Registry →
                  </Link>
                </div>
              </div>
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
