import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/hooks/useIndustry";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { estimateUsageRate, predictScheduleDue } from "@/lib/pm-prediction";
import { SAFE_MACHINE_COLUMNS, parseMachine, normalizeTelematicsStatus, type TelematicsStatus } from "@/lib/fleet-metadata";
import { Activity, Gauge, ShieldCheck, AlertTriangle, Wrench, ClipboardList, Maximize2, Truck, ParkingCircle, CalendarClock } from "lucide-react";

type FleetKpis = {
  running: number;
  idle: number;
  inactive: number;
  stopped: number;
  total: number;
  vehicles: {
    id: string;
    label: string;
    plate: string;
    speed: number;
    ignition: boolean;
    batteryVolt: number | null;
    status: "on_road" | "idle" | "workshop" | "off_road";
    telematicsStatus: TelematicsStatus;
  }[];
};

const emptyFleet: FleetKpis = {
  running: 0,
  idle: 0,
  inactive: 0,
  stopped: 0,
  total: 0,
  vehicles: [],
};

type GarageKpis = {
  inProgress: number;
  estimate: number;
  awaitingApproval: number;
  readyForPickup: number;
  completedToday: number;
  jobs: { id: string; vehicleId?: string; label: string; vehicle: string; customer: string; status: string }[];
};

const emptyGarage: GarageKpis = {
  inProgress: 0,
  estimate: 0,
  awaitingApproval: 0,
  readyForPickup: 0,
  completedToday: 0,
  jobs: [],
};

type Kpis = {
  availableMachines: number;
  inOperationMachines: number;
  totalMachines: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  pmOverdue: number;
  pmDueSoon: number;
  daysSinceIncident: number | null;
  openIncidents: number;
  totalIncidents30d: number;
};

const empty: Kpis = {
  availableMachines: 0, inOperationMachines: 0, totalMachines: 0,
  openWorkOrders: 0, overdueWorkOrders: 0,
  pmOverdue: 0, pmDueSoon: 0,
  daysSinceIncident: null, openIncidents: 0, totalIncidents30d: 0,
};

function colorFor(value: number, good = 85, warn = 65) {
  if (value >= good) return "text-emerald-400";
  if (value >= warn) return "text-amber-400";
  return "text-rose-400";
}

function Tile({
  icon, label, value, sub, accent, big = true,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string; big?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between text-white/60">
        <span className="text-sm uppercase tracking-widest">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className={`mt-3 font-bold leading-none tracking-tight ${big ? "text-6xl md:text-7xl" : "text-4xl md:text-5xl"} ${accent ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-3 text-base text-white/60">{sub}</div>}
    </div>
  );
}

export default function Live() {
  const { user, loading, organisation, profile } = useAuth();
  const { isFleet, isGarage } = useIndustry();
  const [kpis, setKpis] = useState<Kpis>(empty);
  const [fleetKpis, setFleetKpis] = useState<FleetKpis>(emptyFleet);
  const [garageKpis, setGarageKpis] = useState<GarageKpis>(emptyGarage);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Wake lock — keep TV screen on
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const request = async () => {
      try {
        // @ts-expect-error wakeLock is not in the standard lib.dom types yet
        if ("wakeLock" in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {
        // wake lock unsupported/denied — ignore
      }
    };
    request();
    const onVis = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        wakeLockRef.current?.release?.();
      } catch {
        // ignore release errors
      }
    };
  }, []);

  const load = useCallback(async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    const today = new Date().toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [machRes, woRes, schedRes, readingsRes, downtimeRes, incRes, openIncRes] = await Promise.all([
      supabase.from("machines").select("id, name, status, current_hours").eq("organisation_id", orgId),
      supabase
        .from("work_orders")
        .select("id, due_date")
        .eq("organisation_id", orgId)
        .not("status", "in", '("done","closed")'),
      supabase
        .from("service_schedules")
        .select("id, name, next_due_date, next_due_hours, machines!inner(id, name, current_hours, organisation_id)")
        .eq("machines.organisation_id", orgId),
      supabase.from("meter_readings").select("machine_id, reading, reading_date").eq("organisation_id", orgId).order("reading_date", { ascending: false }).limit(1000),
      (supabase as any).from("machine_downtime_events").select("machine_id").eq("organisation_id", orgId).is("ended_at", null),
      supabase.from("safety_incidents").select("occurred_at").eq("organisation_id", orgId).order("occurred_at", { ascending: false }).limit(50),
      supabase.from("safety_incidents").select("id", { count: "exact", head: true }).eq("organisation_id", orgId).neq("status", "closed"),
    ]);

    const machines = machRes.data ?? [];
    const downMachineIds = new Set((downtimeRes.data ?? []).map((d: any) => d.machine_id));
    const availableMachines = machines.filter((m) => m.status === "active").length;
    const inOperationMachines = machines.filter((m) => m.status === "active" && !downMachineIds.has(m.id)).length;

    const wos = woRes.data ?? [];
    const overdueWorkOrders = wos.filter((w: any) => !!w.due_date && w.due_date < today).length;

    const readingsByMachine: Record<string, { reading: number; reading_date: string }[]> = {};
    (readingsRes.data ?? []).forEach((r: any) => {
      (readingsByMachine[r.machine_id] ??= []).push({ reading: r.reading, reading_date: r.reading_date });
    });
    let pmOverdue = 0, pmDueSoon = 0;
    for (const s of schedRes.data ?? []) {
      const usage = estimateUsageRate(readingsByMachine[(s as any).machines?.id] ?? []);
      const pred = predictScheduleDue({
        nextDueDate: (s as any).next_due_date,
        nextDueHours: (s as any).next_due_hours,
        currentHours: (s as any).machines?.current_hours,
        usage,
      });
      if (pred.status === "overdue") pmOverdue++;
      else if (pred.status === "due_soon") pmDueSoon++;
    }

    const incidents = incRes.data ?? [];
    const last = incidents[0]?.occurred_at ? new Date(incidents[0].occurred_at) : null;
    const daysSinceIncident = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    const totalIncidents30d = incidents.filter((i) => i.occurred_at && i.occurred_at >= d30).length;

    setKpis({
      availableMachines, inOperationMachines, totalMachines: machines.length,
      openWorkOrders: wos.length, overdueWorkOrders,
      pmOverdue, pmDueSoon,
      daysSinceIncident, openIncidents: openIncRes.count ?? 0, totalIncidents30d,
    });
    setLastUpdated(new Date());
  }, [organisation?.id]);

  const loadFleet = useCallback(async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    const [{ data: rawMachines }, { data: trips }, { data: openWos }] = await Promise.all([
      supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .eq("organisation_id", orgId),
      supabase.from("trips").select("machine_id, status").eq("organisation_id", orgId).eq("status", "in_progress"),
      supabase.from("work_orders").select("machine_id").eq("organisation_id", orgId).in("status", ["open", "assigned", "in_progress", "waiting_parts"]),
    ]);

    const activeTripIds = new Set((trips ?? []).map((t) => t.machine_id));
    const maintenanceIds = new Set((openWos ?? []).map((w: any) => w.machine_id));

    let running = 0, idle = 0, inactive = 0, stopped = 0;
    const vehicles: FleetKpis["vehicles"] = [];

    for (const raw of (rawMachines ?? []) as any[]) {
      const m = parseMachine(raw);
      const plate = m.plate_number || m.name;
      const label = plate;
      const speed = Number(m.telematics_speed || 0);
      const ignition = Boolean(m.telematics_ignition);
      const isUnderMaint = m.status === "under_maintenance" || maintenanceIds.has(m.id);
      const hasGps = m.telematics_latitude != null && m.telematics_longitude != null;

      // Accurately determine the 4 core telematics motion states: Running, Idle, Inactive, Stopped
      const telematicsStatus: TelematicsStatus = normalizeTelematicsStatus(
        m.telematics_status,
        speed,
        ignition,
        m.telematics_last_at,
        hasGps
      );

      if (telematicsStatus === "Running") {
        running++;
      } else if (telematicsStatus === "Idle") {
        idle++;
      } else if (telematicsStatus === "Inactive") {
        inactive++;
      } else {
        stopped++;
      }

      vehicles.push({
        id: m.id,
        label,
        plate,
        speed,
        ignition,
        batteryVolt: m.telematics_battery_volt ?? null,
        status: isUnderMaint ? "workshop" : telematicsStatus === "Running" ? "on_road" : telematicsStatus === "Idle" ? "idle" : "off_road",
        telematicsStatus,
      });
    }

    setFleetKpis({
      running,
      idle,
      inactive,
      stopped,
      total: (rawMachines ?? []).length,
      vehicles,
    });
    setLastUpdated(new Date());
  }, [organisation?.id, profile?.organisation_id]);

  const loadGarage = useCallback(async () => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: jobs } = await (supabase as any)
      .from("garage_jobs")
      .select("id, job_number, job_year, vehicle_id, status, created_at, garage_customers(name), garage_vehicles(id, make, model, registration_number)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    const allJobs = jobs ?? [];
    let inProgress = 0, estimate = 0, awaitingApproval = 0, readyForPickup = 0, completedToday = 0;
    const recentJobs: GarageKpis["jobs"] = [];

    for (const j of allJobs) {
      if (j.status === "in_progress") inProgress++;
      else if (j.status === "estimate") estimate++;
      else if (j.status === "awaiting_approval") awaitingApproval++;
      else if (j.status === "completed" || j.status === "invoiced") {
        readyForPickup++;
        if (j.created_at?.slice(0, 10) === today) completedToday++;
      }

      if (recentJobs.length < 16) {
        const v = j.garage_vehicles;
        const vStr = v ? `${v.registration_number || ""}${v.make ? ` (${v.make})` : ""}` : "Vehicle";
        recentJobs.push({
          id: j.id,
          vehicleId: j.vehicle_id || v?.id,
          label: `JOB-${j.job_year || new Date().getFullYear()}-${String(j.job_number || 1).padStart(4, "0")}`,
          vehicle: vStr,
          customer: j.garage_customers?.name || "Walk-in Client",
          status: j.status || "in_progress",
        });
      }
    }
    setGarageKpis({ inProgress, estimate, awaitingApproval, readyForPickup, completedToday, jobs: recentJobs });
    setLastUpdated(new Date());
  }, [organisation?.id, profile?.organisation_id]);

  // Initial + polling fallback
  useEffect(() => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    if (isFleet) loadFleet();
    else if (isGarage) loadGarage();
    else load();

    const t = setInterval(() => {
      if (isFleet) loadFleet();
      else if (isGarage) loadGarage();
      else load();
    }, 30000);
    return () => clearInterval(t);
  }, [organisation?.id, profile?.organisation_id, isFleet, isGarage, load, loadFleet, loadGarage]);

  // Realtime subscriptions
  useEffect(() => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) return;
    const channel = supabase.channel(`${orgId}:live-kpis`);
    if (isFleet) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "machines", filter: `organisation_id=eq.${orgId}` }, () => loadFleet())
        .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `organisation_id=eq.${orgId}` }, () => loadFleet());
    } else if (isGarage) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "garage_jobs", filter: `organisation_id=eq.${orgId}` }, () => loadGarage());
    } else {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "machines", filter: `organisation_id=eq.${orgId}` }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "work_orders", filter: `organisation_id=eq.${orgId}` }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "service_schedules" }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "meter_readings", filter: `organisation_id=eq.${orgId}` }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "machine_downtime_events", filter: `organisation_id=eq.${orgId}` }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "safety_incidents", filter: `organisation_id=eq.${orgId}` }, () => load());
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organisation?.id, profile?.organisation_id, isFleet, isGarage, load, loadFleet, loadGarage]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen w-full bg-[#0a0e1a] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.12),transparent_50%)] text-white">
      <div className="mx-auto max-w-[1800px] px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {organisation?.logo_url && (
              <img
                src={organisation.logo_url}
                alt={organisation.name || "Company Logo"}
                className="h-16 w-16 rounded-2xl object-contain border border-white/20 bg-white/10 p-2 shadow-lg shrink-0"
              />
            )}
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{organisation?.name ?? "Live Operations"}</h1>
              <p className="mt-1 text-white/50">
                {isFleet
                  ? "Real-time KPI dashboard"
                  : isGarage
                  ? "Workshop & Garage — live service bay board"
                  : "Maintenance — live KPI dashboard"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10" title="Fullscreen">
              <Maximize2 className="h-5 w-5" />
            </Button>
            <div className="text-right">
              <div className="text-5xl font-bold tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-sm text-white/50">
                {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
                {lastUpdated && <span className="ml-3 inline-flex items-center gap-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> live</span>}
              </div>
            </div>
          </div>
        </div>

        {isFleet ? (
          <>
            {/* FLEET LIVE MOTION STATUS */}
            <SectionTitle icon={<Truck className="h-5 w-5" />} title="Fleet Live Status" />
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Tile
                icon={<Activity className="h-6 w-6" />}
                label="Running"
                value={String(fleetKpis.running)}
                sub="In motion / Driving"
                accent="text-emerald-400"
              />
              <Tile
                icon={<Gauge className="h-6 w-6" />}
                label="Idle"
                value={String(fleetKpis.idle)}
                sub="Engine running / Stationed"
                accent="text-amber-400"
              />
              <Tile
                icon={<AlertTriangle className="h-6 w-6" />}
                label="Inactive"
                value={String(fleetKpis.inactive)}
                sub="Offline / No GPS fix"
                accent="text-slate-400"
              />
              <Tile
                icon={<ParkingCircle className="h-6 w-6" />}
                label="Stopped"
                value={String(fleetKpis.stopped)}
                sub="Parked / Ignition off"
                accent="text-sky-400"
              />
            </div>

            {/* FLEET STATUS BOARD */}
            <SectionTitle icon={<Activity className="h-5 w-5" />} title="Live Fleet Telemetry Board" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {fleetKpis.vehicles.map((v) => (
                <Link
                  key={v.id || v.label}
                  to={`/fleet/vehicles/${v.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/[0.12] hover:border-emerald-500/50 transition-all cursor-pointer block"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-white tracking-wider group-hover:text-emerald-400 transition-colors">
                      {v.plate}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                        v.telematicsStatus === "Running" ? "bg-emerald-500/20 text-emerald-400" :
                        v.telematicsStatus === "Idle" ? "bg-amber-500/20 text-amber-400" :
                        v.telematicsStatus === "Inactive" ? "bg-slate-500/20 text-slate-300" :
                        v.telematicsStatus === "Stopped" ? "bg-sky-500/20 text-sky-400" :
                        v.status === "workshop" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${v.telematicsStatus === "Running" ? "bg-emerald-400 animate-pulse" : "bg-current"}`} />
                      {v.telematicsStatus === "Running" ? (v.speed > 0 ? `${v.speed} km/h` : "Running") :
                       v.telematicsStatus ? v.telematicsStatus :
                       v.status === "workshop" ? "Workshop" : "Off Road"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50 mt-2 pt-2 border-t border-white/5">
                    <span>{v.ignition ? "Engine ON" : "Engine OFF"}</span>
                    {v.batteryVolt != null && <span>{v.batteryVolt}V</span>}
                  </div>
                </Link>
              ))}
              {fleetKpis.vehicles.length === 0 && (
                <div className="col-span-full rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
                  No active fleet vehicles loaded. Auto-import from Trakzee via Fleet &gt; Vehicles.
                </div>
              )}
            </div>
          </>
        ) : isGarage ? (
          <>
            {/* WORKSHOP SERVICE BAYS */}
            <SectionTitle icon={<Wrench className="h-5 w-5" />} title="Workshop Service Bays & Work Orders" />
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Tile icon={<Wrench className="h-6 w-6" />} label="In Progress" value={String(garageKpis.inProgress)} accent="text-amber-400" />
              <Tile icon={<ClipboardList className="h-6 w-6" />} label="Pending Estimates" value={String(garageKpis.estimate)} accent="text-sky-400" />
              <Tile icon={<CalendarClock className="h-6 w-6" />} label="Awaiting Approval" value={String(garageKpis.awaitingApproval)} accent="text-purple-400" />
              <Tile icon={<ShieldCheck className="h-6 w-6" />} label="Ready / Picked Up" value={String(garageKpis.readyForPickup)} sub={`${garageKpis.completedToday} completed today`} accent="text-emerald-400" />
            </div>

            {/* LIVE SERVICE BAY BOARD */}
            <SectionTitle icon={<Activity className="h-5 w-5" />} title="Live Service Bay Board" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {garageKpis.jobs.map((j) => (
                <Link
                  key={j.label}
                  to={j.vehicleId ? `/garage/vehicles/${j.vehicleId}` : `/garage/jobs/${j.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.12] hover:border-sky-500/50 transition-all cursor-pointer block"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-white/90 group-hover:text-sky-400 transition-colors">{j.label}</span>
                    <span
                      className={
                        j.status === "in_progress" ? "text-amber-400 font-semibold text-xs uppercase" :
                        j.status === "estimate" ? "text-sky-400 font-semibold text-xs uppercase" :
                        j.status === "awaiting_approval" ? "text-purple-400 font-semibold text-xs uppercase" :
                        "text-emerald-400 font-semibold text-xs uppercase"
                      }
                    >
                      ● {j.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">{j.vehicle}</div>
                  <div className="text-xs text-white/50 truncate">{j.customer}</div>
                </Link>
              ))}
              {garageKpis.jobs.length === 0 && (
                <div className="col-span-full rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
                  No active workshop jobs in progress. Intake vehicles via the Workshop Jobs module.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* MACHINES */}
            <SectionTitle icon={<Wrench className="h-5 w-5" />} title="Machines" />
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Tile
                icon={<Gauge className="h-6 w-6" />}
                label="Machines Available"
                value={`${kpis.availableMachines}/${kpis.totalMachines}`}
                accent={colorFor((kpis.availableMachines / Math.max(kpis.totalMachines, 1)) * 100, 90, 70)}
              />
              <Tile
                icon={<Activity className="h-6 w-6" />}
                label="In Operation"
                value={`${kpis.inOperationMachines}/${kpis.totalMachines}`}
                accent={colorFor((kpis.inOperationMachines / Math.max(kpis.totalMachines, 1)) * 100, 80, 50)}
              />
              <Tile
                icon={<CalendarClock className="h-6 w-6" />}
                label="PM Overdue"
                value={String(kpis.pmOverdue)}
                sub={`${kpis.pmDueSoon} due soon`}
                accent={kpis.pmOverdue === 0 ? "text-emerald-400" : "text-rose-400"}
              />
              <Tile
                icon={<ClipboardList className="h-6 w-6" />}
                label="Open Work Orders"
                value={String(kpis.openWorkOrders)}
                sub={`${kpis.overdueWorkOrders} overdue`}
                accent={kpis.overdueWorkOrders === 0 ? "text-emerald-400" : "text-amber-400"}
              />
            </div>

            {/* SAFETY */}
            <SectionTitle icon={<ShieldCheck className="h-5 w-5" />} title="Safety" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Tile
                icon={<ShieldCheck className="h-6 w-6" />}
                label="Days Since Incident"
                value={kpis.daysSinceIncident === null ? "∞" : String(kpis.daysSinceIncident)}
                sub={kpis.daysSinceIncident === null ? "No incidents recorded" : "Keep it going"}
                accent={kpis.daysSinceIncident === null || kpis.daysSinceIncident >= 30 ? "text-emerald-400" : kpis.daysSinceIncident >= 7 ? "text-amber-400" : "text-rose-400"}
              />
              <Tile
                icon={<AlertTriangle className="h-6 w-6" />}
                label="Open Incidents"
                value={String(kpis.openIncidents)}
                sub={`${kpis.totalIncidents30d} reported in 30d`}
                accent={kpis.openIncidents === 0 ? "text-emerald-400" : "text-rose-400"}
              />
            </div>
          </>
        )}

        <div className="mt-10 text-center text-xs text-white/30">
          Auto-refresh every 30s · {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : "loading..."}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 mt-10 flex items-center gap-2 text-white/70">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em]">{title}</h2>
      <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
    </div>
  );
}
