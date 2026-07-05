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
import { tyreStatus } from "@/lib/fleet-constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

const toneClasses: Record<string, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_38%)]",
  destructive: "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]",
};

const placeholderWidgets = [
  { id: "status-board", title: "Fleet status board", icon: MapPin },
  { id: "open-wo", title: "Open work orders by vehicle", icon: Wrench },
  { id: "fault-reports", title: "Recent fault reports", icon: AlertTriangle },
  { id: "inspection-rate", title: "Pre-start inspection completion rate", icon: ClipboardCheck },
] as const;

type ExpiryRow = { key: string; typeLabel: string; holderLabel: string; expiresOn: string };
type MachineRow = { id: string; name: string; plate_number: string | null; status: string; current_odometer_km: number | null };
type TripRow = { id: string; machine_id: string; status: string; start_at: string | null; end_at: string | null; start_odo: number | null; end_odo: number | null; fuel_used_l: number | null };
type FuelLogRow = { machine_id: string; recorded_at: string; fuel_cost: number | null };
type TyreRow = { id: string; machine_id: string; position: string; brand: string | null; target_replace_km: number | null; fitted_odo: number | null; removed_at: string | null };

type EfficiencyRow = { machineId: string; label: string; km: number; litres: number; kmPerL: number };
type TyreAlertRow = { key: string; label: string; status: "due_soon" | "overdue" };

export default function FleetDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState<ExpiryRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogRow[]>([]);
  const [tyres, setTyres] = useState<TyreRow[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const [{ data: docs }, { data: m }, { data: drivers }, { data: t }, { data: fl }, { data: ty }] = await Promise.all([
        supabase.from("vehicle_documents").select("id, machine_id, doc_type, expires_on").not("expires_on", "is", null),
        supabase.from("machines").select("id, name, plate_number, status, current_odometer_km"),
        supabase.from("drivers").select("id, full_name, licence_expiry, medical_expiry").eq("status", "active"),
        supabase.from("trips").select("id, machine_id, status, start_at, end_at, start_odo, end_odo, fuel_used_l"),
        supabase.from("fuel_logs").select("machine_id, recorded_at, fuel_cost"),
        supabase.from("tyres").select("id, machine_id, position, brand, target_replace_km, fitted_odo, removed_at").is("removed_at", null),
      ]);

      type DocRow = { id: string; machine_id: string; doc_type: string; expires_on: string };
      type DriverRow = { id: string; full_name: string; licence_expiry: string | null; medical_expiry: string | null };

      const machineList = (m ?? []) as MachineRow[];
      const machineMap = new Map(machineList.map((mm) => [mm.id, mm]));
      const rows: ExpiryRow[] = [];
      for (const d of (docs ?? []) as DocRow[]) {
        const mm = machineMap.get(d.machine_id);
        const label = mm ? (mm.plate_number ? `${mm.name} (${mm.plate_number})` : mm.name) : "Vehicle";
        rows.push({ key: `doc-${d.id}`, typeLabel: d.doc_type, holderLabel: label, expiresOn: d.expires_on });
      }
      for (const dr of (drivers ?? []) as DriverRow[]) {
        if (dr.licence_expiry) rows.push({ key: `dl-${dr.id}`, typeLabel: "Driving licence", holderLabel: dr.full_name, expiresOn: dr.licence_expiry });
        if (dr.medical_expiry) rows.push({ key: `dm-${dr.id}`, typeLabel: "Medical certificate", holderLabel: dr.full_name, expiresOn: dr.medical_expiry });
      }
      rows.sort((a, b) => new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime());

      setExpiring(rows);
      setMachines(machineList);
      setTrips((t ?? []) as TripRow[]);
      setFuelLogs((fl ?? []) as FuelLogRow[]);
      setTyres((ty ?? []) as TyreRow[]);
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
      rows.push({ key: ty.id, label: `${vehicleLabel(ty.machine_id)} · ${ty.position}${ty.brand ? ` (${ty.brand})` : ""}`, status });
    }
    return rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "overdue" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tyres, machines]);

  const kpiCards = [
    {
      label: "Vehicles on road today",
      value: loading ? "—" : String(onRoadMachineIds.size),
      sub: loading ? "" : `${onRoadMachineIds.size} / ${activeMachines.length} active · ${availabilityPct}% availability`,
      icon: Truck,
      tone: "default",
    },
    {
      label: "Trips today",
      value: loading ? "—" : String(tripsInProgressToday + tripsCompletedToday),
      sub: loading ? "" : `${tripsInProgressToday} in progress / ${tripsCompletedToday} completed`,
      icon: Route,
      tone: "success",
    },
    {
      label: "Fuel cost this week",
      value: loading ? "—" : formatMoney(fuelCostThisWeek),
      sub: fuelDeltaLabel,
      icon: Fuel,
      tone: "warning",
    },
    {
      label: "Documents expiring in 30 days",
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
        <h1 className="text-2xl font-semibold tracking-tight">Fleet Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          An overview of your fleet's vehicles, trips and maintenance.
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
              <h2 className="text-sm font-medium text-foreground">Expiring documents</h2>
            </div>
            <Link to="/fleet/documents" className="text-xs font-medium text-primary hover:underline">
              View all
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
            <h2 className="text-sm font-medium text-foreground">Fuel efficiency leaderboard</h2>
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
              <h2 className="text-sm font-medium text-foreground">Tyre alerts</h2>
            </div>
            <Link to="/fleet/tyres" className="text-xs font-medium text-primary hover:underline">
              View all
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

        {placeholderWidgets.map((w) => (
          <div key={w.id} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <w.icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">{w.title}</h2>
            </div>
            <EmptyState
              icon={<w.icon className="h-5 w-5" />}
              title="No data yet"
              description="This widget will populate once fleet data starts flowing in."
            />
          </div>
        ))}
      </div>
    </div>
  );
}
