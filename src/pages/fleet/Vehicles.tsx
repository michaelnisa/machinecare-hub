import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { CoverImage } from "@/components/CoverImage";
import { scheduleStatus } from "@/lib/machine-constants";
import { formatNumber } from "@/lib/format";
import { 
  Truck, 
  Search, 
  Plus, 
  Pencil, 
  Loader2, 
  Upload, 
  ClipboardList, 
  QrCode, 
  FileSpreadsheet,
  Container,
  Layers,
  Link2,
  Fuel,
  Wrench,
  Clock,
  CheckCircle2,
  List,
  LayoutGrid,
  RefreshCw,
  Eye,
  Radio,
  MapPin,
  Zap,
  Wind,
  Droplets,
  Boxes,
  Factory,
  Cog,
  Gauge,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { BulkImporterModal } from "@/components/BulkImporterModal";
import { syncTrakzeeFleet } from "@/services/trakzeeService";
import {
  SAFE_MACHINE_COLUMNS,
  FLEET_AND_ASSET_CATEGORIES,
  isWorkshopAssetCategory,
  parseMachine,
  serializeMachinePayload,
  generateVehicleCode,
  normalizeTelematicsStatus,
  type FleetVehicle,
  AXLE_CONFIG_OPTIONS,
  TANZANIA_COMMERCIAL_MAKES,
} from "@/lib/fleet-metadata";
import type { TruckLayoutConfigId } from "@/lib/fleet-constants";
import { isEnterpriseFleet } from "@/lib/fleetTiers";

type Trip = {
  machine_id: string;
  driver_id: string | null;
  status: string;
  start_at: string | null;
};

type Schedule = {
  machine_id: string;
  next_due_date: string | null;
};

type VehicleDoc = {
  machine_id: string;
  expires_on: string | null;
};

type Driver = { id: string; full_name: string };

const FUEL_TYPES = ["diesel", "petrol", "electric", "hybrid"];

const VEHICLE_TYPES = [
  { value: "truck", label: "Commercial Hauler / Truck" },
  { value: "prime_mover", label: "Prime Mover / Tractor Head" },
  { value: "tanker", label: "Tanker Truck (Fuel / Liquid)" },
  { value: "rigid", label: "Rigid Truck" },
  { value: "rigid_trailer", label: "Rigid Truck with Trailer" },
  { value: "van_pickup", label: "Van / Pickup / Utility" },
  { value: "bus", label: "Bus / Commuter" },
  { value: "trailer", label: "Trailer / Semi-Trailer" },
  { value: "other", label: "Other" },
];

export const WORKSHOP_ASSET_TYPES = [
  { value: "Generator", label: "Generator (Standby Genset / Diesel Generator)", defaultCode: "GEN", defaultHours: "250", icon: Zap },
  { value: "Compressor", label: "Air Compressor (Rotary Screw / Piston / Workshop)", defaultCode: "CMP", defaultHours: "250", icon: Wind },
  { value: "Pump", label: "Industrial Pump (Water / Fuel Transfer / Chemical)", defaultCode: "PMP", defaultHours: "250", icon: Droplets },
  { value: "Forklift", label: "Forklift / Material Handling (Diesel / Electric)", defaultCode: "FLK", defaultHours: "250", icon: Boxes },
  { value: "Workshop Equipment", label: "Workshop Equipment (Vehicle Lifts, Tire Changers, Scanners)", defaultCode: "WKS", defaultHours: "500", icon: Wrench },
  { value: "Boiler", label: "Steam Boiler / Heating Plant", defaultCode: "PLT", defaultHours: "500", icon: Factory },
  { value: "Auxiliary Plant", label: "Auxiliary Plant Equipment & Bottling Machinery", defaultCode: "PLT", defaultHours: "500", icon: Cog },
];

export const ASSET_POWER_SOURCES = [
  { value: "diesel", label: "Diesel Engine" },
  { value: "electric_3p", label: "3-Phase Electric (400V / 415V)" },
  { value: "electric_1p", label: "Single Phase Electric (220V / 240V)" },
  { value: "petrol", label: "Petrol Engine" },
  { value: "hydraulic", label: "Hydraulic Power Pack" },
  { value: "pneumatic", label: "Pneumatic / Air-Powered" },
  { value: "solar_hybrid", label: "Solar / Battery Hybrid" },
];

const EMPTY_FORM = {
  category: "Vehicle" as string,
  asset_kind: "vehicle" as "vehicle" | "trailer" | "workshop_asset",
  asset_type: "Generator",
  vehicle_code: "",
  name: "",
  plate_number: "",
  serial_number: "",
  rated_power_capacity: "",
  purchase_date: "",
  purchase_cost: "",
  make: "",
  model: "",
  year: "",
  vin: "",
  fuel_type: "diesel",
  vehicle_type: "truck",
  axle_configuration: "6x4" as TruckLayoutConfigId,
  is_trailer: false,
  trailer_mode: "none" as "none" | "fleet" | "manual",
  linked_trailer_id: "",
  trailer_plate: "",
  trailer_make_model: "",
  head_tank_capacity_l: "",
  trailer_tank_capacity_l: "",
  total_tank_capacity_l: "",
  tank_capacity_l: "",
  current_odometer_km: "",
  current_hours: "",
  telematics_imei: "",
  auto_pm_enabled: false,
  auto_pm_hours_interval: "250",
  auto_pm_km_interval: "10000",
  home_depot: "",
  status: "active",
  user_notes: "",
};

export default function Vehicles() {
  const { profile, organisation } = useAuth();
  const { canWrite } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [assetTab, setAssetTab] = useState<"all" | "vehicles" | "trailers" | "workshop_assets">(() => {
    const tabP = searchParams.get("tab");
    if (tabP === "plant" || tabP === "workshop" || tabP === "workshop_assets") return "workshop_assets";
    if (tabP === "trailers" || tabP === "trailer") return "trailers";
    if (tabP === "vehicles" || tabP === "trucks") return "vehicles";
    return "all";
  });
  const [status, setStatus] = useState<string>("all");
  const initialView = searchParams.get("view") === "live" ? "live" : searchParams.get("view") === "table" ? "table" : "cards";
  const [viewMode, setViewMode] = useState<"table" | "cards" | "live">(initialView);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [initialCategory, setInitialCategory] = useState<string>("Vehicle");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMachine, setQrMachine] = useState<FleetVehicle | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [syncingTrakzee, setSyncingTrakzee] = useState(false);

  const isTelematicsEnabled = Boolean(
    organisation?.trakzee_enabled ||
    organisation?.id === "df6b0c4b-e56b-4694-838a-0381eb480043" ||
    organisation?.name?.toLowerCase().includes("logistix")
  );

  const handleSyncTrakzee = async (autoImport: boolean | unknown = true) => {
    const orgId = organisation?.id || profile?.organisation_id;
    if (!orgId) {
      toast.error("Organisation not loaded yet. Please wait a moment.");
      return;
    }
    if (!isTelematicsEnabled) {
      toast.info("Trakzee GPS telematics is not enabled for this organisation.");
      return;
    }
    const shouldImport = typeof autoImport === "boolean" ? autoImport : true;
    setSyncingTrakzee(true);
    const res = await syncTrakzeeFleet(orgId, shouldImport);
    setSyncingTrakzee(false);
    if (!res.success) {
      toast.error(res.error || "Failed to sync Trakzee GPS");
    } else if (res.vehicles_updated === 0 && (res.vehicles_returned ?? 0) === 0) {
      toast.info("Trakzee API connected, but returned 0 online vehicles.");
    } else {
      toast.success(`Trakzee GPS synced: ${res.vehicles_updated} vehicle(s) updated / imported`);
      load();
    }
  };

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [
      { data: m, error: e1 },
      { data: t, error: e2 },
      { data: s, error: e3 },
      { data: doc, error: e4 },
      { data: d, error: e5 },
    ] = await Promise.all([
      supabase
        .from("machines")
        .select(SAFE_MACHINE_COLUMNS)
        .in("category", FLEET_AND_ASSET_CATEGORIES as any)
        .order("name"),
      supabase.from("trips").select("machine_id, driver_id, status, start_at").order("start_at", { ascending: false }),
      supabase.from("service_schedules").select("machine_id, next_due_date").order("next_due_date", { nullsFirst: false }),
      supabase.from("vehicle_documents").select("machine_id, expires_on").order("expires_on", { nullsFirst: false }),
      supabase.from("drivers").select("id, full_name"),
    ]);

    if (e1) {
      toast.error(e1.message || "Failed to load vehicles");
    } else if (e2 || e3 || e4 || e5) {
      console.warn("Some ancillary fleet data could not be fetched:", { e2, e3, e4, e5 });
    }

    const parsedMachines = (m ?? []).map((raw, idx) => parseMachine(raw, idx));
    setMachines(parsedMachines);
    setTrips((t ?? []) as Trip[]);
    setSchedules((s ?? []) as Schedule[]);
    setDocs((doc ?? []) as VehicleDoc[]);
    setDrivers((d ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d.full_name])), [drivers]);

  const isEnterprise = isEnterpriseFleet(organisation);

  // Workshop non-vehicle assets (Generators, Compressors, Pumps, Lifts - Slide 19)
  const workshopAssets = useMemo(
    () => machines.filter((m) => m.is_workshop_asset || isWorkshopAssetCategory(m.category, m.notes)),
    [machines]
  );
  // Trailers registered in fleet
  const fleetTrailers = useMemo(
    () => machines.filter((m) => (m.is_trailer || m.category === "Trailer") && !m.is_workshop_asset && !isWorkshopAssetCategory(m.category, m.notes)),
    [machines]
  );
  const powerUnits = useMemo(
    () => machines.filter((m) => !m.is_trailer && m.category !== "Trailer" && !m.is_workshop_asset && !isWorkshopAssetCategory(m.category, m.notes)),
    [machines]
  );

  // Current driver per vehicle: prioritizes telematics driver name from Trakzee, else assigned driver, else active trip driver
  const currentDriver = useMemo(() => {
    const map = new Map<string, { name: string; onTrip: boolean }>();
    for (const m of machines) {
      if (m.telematics_driver_name) {
        map.set(m.id, {
          name: m.telematics_driver_name,
          onTrip: Number(m.telematics_speed || 0) > 0 || Boolean(m.telematics_ignition),
        });
      }
    }
    // Fallback: match drivers who have an assigned vehicle note
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
    for (const t of trips) {
      if (map.has(t.machine_id) || !t.driver_id) continue;
      map.set(t.machine_id, { name: driverMap.get(t.driver_id) ?? "—", onTrip: t.status === "in_progress" });
    }
    return map;
  }, [trips, driverMap, machines, drivers]);

  // Earliest upcoming service due date per vehicle
  const nextDueByMachine = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (!s.next_due_date) continue;
      const existing = map.get(s.machine_id);
      if (!existing || new Date(s.next_due_date) < new Date(existing)) map.set(s.machine_id, s.next_due_date);
    }
    return map;
  }, [schedules]);

  // Earliest expiring document per vehicle
  const nextDocExpiryByMachine = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of docs) {
      if (!doc.expires_on) continue;
      const existing = map.get(doc.machine_id);
      if (!existing || new Date(doc.expires_on) < new Date(existing)) map.set(doc.machine_id, doc.expires_on);
    }
    return map;
  }, [docs]);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      const isWsAsset = m.is_workshop_asset || isWorkshopAssetCategory(m.category, m.notes);
      const isTrl = (m.is_trailer || m.category === "Trailer") && !isWsAsset;
      const isTruck = !isTrl && !isWsAsset;

      if (assetTab === "vehicles" && !isTruck) return false;
      if (assetTab === "trailers" && !isTrl) return false;
      if (assetTab === "workshop_assets" && !isWsAsset) return false;
      if (status !== "all") {
        if (status === "active") {
          if (m.status !== "active" && m.status !== "operational") return false;
        } else if (m.status !== status) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !(m.vehicle_code ?? "").toLowerCase().includes(q) &&
          !(m.plate_number ?? "").toLowerCase().includes(q) &&
          !(m.serial_number ?? "").toLowerCase().includes(q) &&
          !(m.trailer_plate ?? "").toLowerCase().includes(q) &&
          !(m.make ?? "").toLowerCase().includes(q) &&
          !(m.model ?? "").toLowerCase().includes(q) &&
          !(m.category ?? "").toLowerCase().includes(q) &&
          !(m.rated_power_capacity ?? "").toLowerCase().includes(q) &&
          !(m.home_depot ?? "").toLowerCase().includes(q) &&
          !(m.axle_configuration ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [machines, assetTab, status, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles & Assets</h1>
          <p className="text-sm text-muted-foreground">
            Complete registry of commercial fleet vehicles, trailers, and stationary workshop assets (Slide 19).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            asChild
            className="gap-1.5 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-sm"
            title="Open full-screen Live GPS Fleet map"
          >
            <Link to="/fleet/live-map">
              <MapPin className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              Live GPS Fleet
            </Link>
          </Button>
          {canWrite && (
            <>
              {isTelematicsEnabled && (
                <Button
                  variant="outline"
                  onClick={() => handleSyncTrakzee(true)}
                  disabled={syncingTrakzee}
                  className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
                  title="Sync live odometer, speed, and GPS location from Trakzee"
                >
                  <Radio className={`h-3.5 w-3.5 ${syncingTrakzee ? "animate-pulse text-amber-500" : "text-emerald-500"}`} />
                  {syncingTrakzee ? "Syncing GPS..." : "Sync GPS"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel / CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setInitialCategory("Generator");
                  setOpen(true);
                }}
                className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 shadow-2xs font-medium"
                title="Register Non-Vehicle Workshop Assets (Generators, Compressors, Pumps, Lifts - Slide 19)"
              >
                <Wrench className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> + Add Plant / Equipment
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setInitialCategory("Trailer");
                  setOpen(true);
                }}
                className="border-dashed border-primary/50 text-primary hover:bg-primary/5"
              >
                <Container className="mr-2 h-4 w-4" /> Add Trailer
              </Button>
              <Button onClick={() => {
                setEditing(null);
                setInitialCategory("Vehicle");
                setOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" /> + Register Vehicle / Asset
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Asset Overview Badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Power Units & Trucks</span>
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{powerUnits.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Tractors, tankers & rigids</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Independent Trailers</span>
            <Container className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{fleetTrailers.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Tri-axle & tandem semi-trailers</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Workshop & Plant Assets</span>
            <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {workshopAssets.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Generators, pumps, compressors & lifts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Active & Operational</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {machines.filter((m) => m.status === "active" || m.status === "operational").length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Operational units ready for service</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={assetTab}
          onValueChange={(v) => {
            const nextTab = v as any;
            setAssetTab(nextTab);
            const newParams = new URLSearchParams(searchParams);
            if (nextTab === "all") newParams.delete("tab");
            else newParams.set("tab", nextTab);
            setSearchParams(newParams, { replace: true });
          }}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All Assets ({machines.length})</TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Trucks ({powerUnits.length})
            </TabsTrigger>
            <TabsTrigger value="trailers" className="flex items-center gap-1.5">
              <Container className="h-3.5 w-3.5" /> Trailers ({fleetTrailers.length})
            </TabsTrigger>
            {(isEnterprise || workshopAssets.length > 0) && (
              <TabsTrigger value="workshop_assets" className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <Wrench className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Workshop Plant ({workshopAssets.length})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, tag, S/N, plate, make..." className="pl-9 h-9 text-sm" />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t.fleet.allStatuses}</option>
            <option value="active">Active / Operational</option>
            <option value="workshop">In Workshop</option>
            <option value="under_maintenance">Under maintenance</option>
            <option value="breakdown">Breakdown</option>
            <option value="out_of_service">Out of service</option>
            <option value="retired">Retired</option>
            <option value="disposed">Disposed</option>
          </select>
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "live" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
              onClick={() => {
                setViewMode("live");
                setSearchParams((p) => { p.set("view", "live"); return p; });
              }}
              title="Live Telematics & Motion Status"
            >
              <Radio className="h-3.5 w-3.5 text-emerald-600" /> Live Status
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
              onClick={() => {
                setViewMode("table");
                setSearchParams((p) => { p.set("view", "table"); return p; });
              }}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" /> Table
            </Button>
            <Button
              type="button"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
              onClick={() => {
                setViewMode("cards");
                setSearchParams((p) => { p.set("view", "cards"); return p; });
              }}
              title="Badges / Cards View"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Badges
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title={machines.length === 0 ? t.fleet.noVehiclesTitle : t.fleet.noVehiclesFiltered}
          description={
            machines.length === 0
              ? t.fleet.noVehiclesDesc
              : "Try changing or clearing filters."
          }
          action={
            machines.length === 0 && canWrite ? (
              <Button onClick={() => { setEditing(null); setInitialCategory("Vehicle"); setOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> {t.fleet.addVehicle}
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const isWsAsset = m.is_workshop_asset || isWorkshopAssetCategory(m.category, m.notes);
            const isTrailer = !isWsAsset && (m.is_trailer || m.category === "Trailer");
            const driver = currentDriver.get(m.id);
            const axleMatch = AXLE_CONFIG_OPTIONS.find((a) => a.value === m.axle_configuration);
            const totalTank = m.total_tank_capacity_l ?? m.tank_capacity_l;

            return (
              <div
                key={m.id}
                className="group relative rounded-xl border border-border bg-card p-4 shadow-2xs hover:shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: Photo + Name + ID + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/fleet/vehicles/${m.id}`}
                        className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted ring-2 ring-transparent group-hover:ring-primary/20 transition-all"
                      >
                        <CoverImage
                          value={m.cover_image_url}
                          alt={m.name}
                          className="h-full w-full object-cover"
                          fallback={
                            isWsAsset ? (
                              m.category === "Generator" ? (
                                <Zap className="h-6 w-6 text-emerald-500" />
                              ) : m.category === "Compressor" ? (
                                <Wind className="h-6 w-6 text-sky-500" />
                              ) : m.category === "Pump" ? (
                                <Droplets className="h-6 w-6 text-cyan-500" />
                              ) : m.category === "Forklift" ? (
                                <Boxes className="h-6 w-6 text-emerald-600" />
                              ) : (
                                <Wrench className="h-6 w-6 text-emerald-500" />
                              )
                            ) : isTrailer ? (
                              <Container className="h-6 w-6 text-emerald-600" />
                            ) : (
                              <Truck className="h-6 w-6 text-muted-foreground" />
                            )
                          }
                        />
                      </Link>
                      <div>
                        <Link
                          to={`/fleet/vehicles/${m.id}`}
                          className="font-semibold text-foreground group-hover:text-primary transition-colors block text-base leading-tight"
                        >
                          {m.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted/80 text-foreground border border-border/80">
                            <span className="text-[9px] uppercase font-sans text-muted-foreground">ID</span>
                            <span>{m.vehicle_code}</span>
                          </div>
                          {isWsAsset ? (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Wrench className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" /> {m.category || "Workshop Asset"}
                            </span>
                          ) : isTrailer ? (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-500/20">
                              Trailer
                            </span>
                          ) : (
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-500/20">
                              Truck
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={m.status} />
                  </div>

                  {/* Quick Specifications */}
                  {isWsAsset ? (
                    <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Asset Category:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{m.category || "Workshop Asset"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Serial Number:</span>
                        <span className="font-semibold text-foreground font-mono">{m.serial_number || "—"}</span>
                      </div>
                      {m.rated_power_capacity && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Rated Power/Cap:</span>
                          <span className="font-medium text-foreground">{m.rated_power_capacity}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 text-primary" /> Operating Hours:
                        </span>
                        <span className="font-semibold text-foreground">
                          {m.current_hours != null ? `${formatNumber(m.current_hours)} hrs` : "0 hrs"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Location / Bay:</span>
                        <span className="font-medium text-foreground">{m.home_depot || "Main Workshop"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Plate Number:</span>
                        <span className="font-semibold text-foreground font-mono">{m.plate_number || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Axle & Layout:</span>
                        <span className="font-medium text-foreground text-right truncate max-w-[200px]" title={axleMatch?.label}>
                          {axleMatch ? axleMatch.label.split("(")[0].trim() : m.axle_configuration || "6x4"}
                        </span>
                      </div>

                      {!isTrailer && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Hitched Unit:</span>
                          {m.has_trailer && m.trailer_plate ? (
                            <span className="font-medium text-primary flex items-center gap-1">
                              <Link2 className="h-3 w-3" /> {m.trailer_plate}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground">Solo</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Driver:</span>
                        <span className="font-medium text-foreground">{driver?.name ?? "Unassigned"}</span>
                      </div>

                      {totalTank != null && totalTank > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tank Capacity:</span>
                          <span className="font-medium text-foreground">{formatNumber(totalTank)} L</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 cursor-pointer"
                    asChild
                  >
                    <Link to={`/fleet/vehicles/${m.id}`}>
                      <Eye className="h-3.5 w-3.5 text-primary" /> View Details
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => { setQrMachine(m); setQrOpen(true); }}
                    title="Asset QR Code"
                  >
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                  </Button>

                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer"
                      onClick={() => { setEditing(m); setOpen(true); }}
                      title="Edit asset"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "live" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>Live Fleet Telematics & Motion Status ({filtered.length})</span>
            </div>
            <span className="text-xs text-muted-foreground">Real-time GPS fixes, drivers, and speed</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
                <tr>
                  <th className="px-5 py-3 font-medium">Vehicle / Plate</th>
                  <th className="px-5 py-3 font-medium">Live Motion</th>
                  <th className="px-5 py-3 font-medium">Assigned Driver</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Cached Odometer</th>
                  <th className="px-5 py-3 font-medium">Next Service</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const driver = currentDriver.get(m.id);
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
                      <td className="px-5 py-3">
                        <Link to={`/fleet/vehicles/${m.id}`} className="font-semibold text-foreground hover:underline">
                          {m.plate_number || m.name}
                        </Link>
                        {m.plate_number && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{m.name}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3 text-sm">
                        {driver ? (
                          <div className="font-medium text-foreground">
                            {driver.name}
                            {driver.onTrip && <span className="ml-1 text-xs text-emerald-600">· active</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-[240px] truncate" title={m.telematics_location || m.home_depot || ""}>
                        {m.telematics_location || m.home_depot || "—"}
                      </td>
                      <td className="px-5 py-3 font-mono font-medium text-foreground">
                        {m.current_odometer_km ? `${formatNumber(m.current_odometer_km)} km` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {nextDue ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDate(nextDue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                            <Link to={`/fleet/vehicles/${m.id}`}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Live GPS Map">
                            <Link to={`/fleet/live-map?selected=${m.id}`}>
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                            </Link>
                          </Button>
                          {canWrite && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(m); setOpen(true); }} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium flex items-center justify-between">
            <span>Vehicles & Assets ({filtered.length})</span>
            <span className="text-xs text-muted-foreground">Power Units, Independent Trailers & Workshop Plant</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
                <tr>
                  <th className="px-5 py-3 font-medium">Asset & Classification</th>
                  <th className="px-5 py-3 font-medium">Plate / Asset Tag & S/N</th>
                  <th className="px-5 py-3 font-medium">Axles / Rated Capacity</th>
                  <th className="px-5 py-3 font-medium">Fuel Tank (Day/Head/Trl)</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDriver}</th>
                  <th className="px-5 py-3 font-medium">Runtime / Odometer</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colNextService}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDocs}</th>
                  <th className="px-5 py-3 font-medium">Location / Depot</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colStatus}</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const isWsAsset = m.is_workshop_asset || isWorkshopAssetCategory(m.category, m.notes);
                  const isTrailer = !isWsAsset && (m.is_trailer || m.category === "Trailer");
                  const driver = currentDriver.get(m.id);
                  const nextDue = nextDueByMachine.get(m.id) ?? null;
                  const nextDocExpiry = nextDocExpiryByMachine.get(m.id) ?? null;
                  const totalTank = m.total_tank_capacity_l ?? m.tank_capacity_l;
                  const hasMultiTank = m.has_trailer || m.head_tank_capacity_l != null || m.trailer_tank_capacity_l != null;
                  const axleMatch = AXLE_CONFIG_OPTIONS.find((a) => a.value === m.axle_configuration);

                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/40">
                      {/* Asset & Classification */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                            <CoverImage
                              value={m.cover_image_url}
                              alt={m.name}
                              className="h-full w-full object-cover"
                              fallback={
                                isWsAsset ? (
                                  m.category === "Generator" ? (
                                    <Zap className="h-4 w-4 text-emerald-500" />
                                  ) : m.category === "Compressor" ? (
                                    <Wind className="h-4 w-4 text-sky-500" />
                                  ) : m.category === "Pump" ? (
                                    <Droplets className="h-4 w-4 text-cyan-500" />
                                  ) : m.category === "Forklift" ? (
                                    <Boxes className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Wrench className="h-4 w-4 text-emerald-500" />
                                  )
                                ) : isTrailer ? (
                                  <Container className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Truck className="h-4 w-4 text-muted-foreground" />
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link to={`/fleet/vehicles/${m.id}`} className="font-semibold hover:underline text-foreground">
                                {m.name}
                              </Link>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted/80 text-foreground border border-border/80">
                                <span className="text-[9px] uppercase font-sans text-muted-foreground">ID</span>
                                <span>{m.vehicle_code}</span>
                              </span>
                              {isWsAsset ? (
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  {m.category || "Workshop Plant"}
                                </span>
                              ) : isTrailer ? (
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-500/20">
                                  Trailer
                                </span>
                              ) : (
                                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-500/20">
                                  Truck
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                              {[m.make, m.model, m.year].filter(Boolean).join(" · ") || (isWsAsset ? "Workshop Equipment" : isTrailer ? "Semi-Trailer" : "Vehicle")}
                              {!isTrailer && !isWsAsset && m.vehicle_type && (
                                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium capitalize text-muted-foreground border">
                                  {m.vehicle_type.replace("_", " ")}
                                </span>
                              )}
                              {isWsAsset && m.serial_number && (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  S/N: {m.serial_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plate & Hitched Unit / S/N */}
                      <td className="px-5 py-3">
                        {isWsAsset ? (
                          <div>
                            <div className="font-semibold text-foreground font-mono">{m.plate_number || m.vehicle_code}</div>
                            <div className="text-[11px] text-muted-foreground">{m.home_depot || "Main Workshop"}</div>
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-foreground">{m.plate_number ?? "—"}</div>
                            {isTrailer ? (
                              <div className="text-[11px] text-muted-foreground">Independent asset</div>
                            ) : m.has_trailer && m.trailer_plate ? (
                              <div className="mt-0.5 inline-flex items-center gap-1">
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary border border-primary/20 flex items-center gap-1">
                                  <Link2 className="h-3 w-3" /> Trailer: {m.trailer_plate}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">No trailer (Solo)</span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Axle Configuration / Rated Power */}
                      <td className="px-5 py-3">
                        {isWsAsset ? (
                          <div>
                            <div className="font-medium text-foreground">{m.rated_power_capacity || "Stationary Unit"}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">Power: {m.fuel_type?.replace(/_/g, " ") || "Electric / Diesel"}</div>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-foreground">
                              {axleMatch ? axleMatch.label : m.axle_configuration || "6x4"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {axleMatch ? `${axleMatch.tyreCount} tyre positions` : "Standard configuration"}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Tank Capacity (Head / Trailer / Total) */}
                      <td className="px-5 py-3">
                        {totalTank ? (
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1">
                              <Fuel className="h-3.5 w-3.5 text-primary" />
                              <span>{formatNumber(totalTank)} L</span>
                              <span className="text-[10px] text-muted-foreground font-normal">{isWsAsset ? "Day Tank" : "Total"}</span>
                            </div>
                            {!isWsAsset && hasMultiTank && (m.head_tank_capacity_l != null || m.trailer_tank_capacity_l != null) && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Head: {m.head_tank_capacity_l != null ? `${formatNumber(m.head_tank_capacity_l)}L` : "—"} · Trl: {m.trailer_tank_capacity_l != null ? `${formatNumber(m.trailer_tank_capacity_l)}L` : "—"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="px-5 py-3 text-muted-foreground">
                        {isWsAsset ? (
                          <span className="text-xs text-muted-foreground font-medium">Workshop Plant</span>
                        ) : isTrailer ? (
                          <span className="text-xs text-muted-foreground italic">Towed unit</span>
                        ) : driver ? (
                          <>
                            {driver.name}
                            {driver.onTrip && <span className="ml-1.5 text-xs text-primary font-medium">· on trip</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Odometer / Operating Hours */}
                      <td className="px-5 py-3 text-muted-foreground">
                        {isWsAsset ? (
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>{m.current_hours != null ? `${formatNumber(m.current_hours)} hrs` : "0 hrs"}</span>
                          </div>
                        ) : m.current_odometer_km != null ? (
                          `${formatNumber(m.current_odometer_km)} km`
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Next Service */}
                      <td className="px-5 py-3">
                        {nextDue ? <StatusBadge status={scheduleStatus(nextDue)} /> : <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Documents */}
                      <td className="px-5 py-3">
                        {nextDocExpiry ? (
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={scheduleStatus(nextDocExpiry)} />
                            <span className="text-[10px] text-muted-foreground">
                              exp. {new Date(nextDocExpiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Home Depot */}
                      <td className="px-5 py-3 text-muted-foreground">{m.home_depot ?? "—"}</td>

                      {/* Status */}
                      <td className="px-5 py-3"><StatusBadge status={m.status} /></td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setQrMachine(m); setQrOpen(true); }}
                            title="Asset QR Code"
                          >
                            <QrCode className="h-4 w-4 text-primary" />
                          </Button>
                          {canWrite && (
                            <Button variant="ghost" size="icon" asChild title={t.fleet.newJobCard}>
                              <Link to={`/work-orders/new?machine=${m.id}`}>
                                <ClipboardList className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setOpen(true); }} title={t.fleet.editVehicle}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <VehicleDialog
        open={open}
        onOpenChange={setOpen}
        machine={editing}
        initialCategory={initialCategory}
        availableTrailers={fleetTrailers}
        existingCount={initialCategory === "Trailer" ? fleetTrailers.length : powerUnits.length}
        onSaved={(createdMachine?: any) => {
          load();
          if (createdMachine) {
            setQrMachine({
              ...createdMachine,
              vehicle_code: createdMachine.registration_number || createdMachine.vehicle_code,
            });
            setQrOpen(true);
          }
        }}
      />

      {/* QR Dialog */}
      {qrMachine && (
        <MachineQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          machineId={qrMachine.id}
          machineName={qrMachine.name}
          qrEnabled={true}
          plateNumber={qrMachine.plate_number}
          registrationNumber={qrMachine.vehicle_code || (qrMachine as any).registration_number}
          currentHours={qrMachine.current_odometer_km ?? (qrMachine as any).current_hours}
          category={qrMachine.category}
          make={qrMachine.make}
          model={qrMachine.model}
          year={qrMachine.year}
          serialNumber={(qrMachine as any).serial_number}
          vin={(qrMachine as any).vin}
          organisationName={organisation?.name}
          organisationLogoUrl={organisation?.logo_url}
          assignedDriverName={currentDriver.get(qrMachine.id)?.name}
        />
      )}

      {/* Bulk Importer */}
      <BulkImporterModal
        entity="vehicle"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />
    </div>
  );
}

export function VehicleDialog({
  open,
  onOpenChange,
  machine,
  initialCategory = "Vehicle",
  availableTrailers,
  existingCount,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machine: FleetVehicle | null;
  initialCategory?: string;
  availableTrailers: FleetVehicle[];
  existingCount?: number;
  onSaved: (createdRecord?: any) => void;
}) {
  const { profile, user, organisation } = useAuth();
  const isEnterprise = isEnterpriseFleet(organisation);
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [customMake, setCustomMake] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (machine) {
        const isWsAsset = machine.is_workshop_asset || isWorkshopAssetCategory(machine.category, machine.notes);
        const isTrailer = !isWsAsset && (machine.is_trailer || machine.category === "Trailer");
        let trailerMode: "none" | "fleet" | "manual" = "none";
        if (machine.linked_trailer_id) {
          trailerMode = "fleet";
        } else if (machine.trailer_plate) {
          trailerMode = "manual";
        }

        const existingMake = (machine.make || "").trim();
        const isInList = TANZANIA_COMMERCIAL_MAKES.some(
          (m) => m.name.toLowerCase() === existingMake.toLowerCase()
        );
        setCustomMake(!isInList && Boolean(existingMake));

        setForm({
          category: machine.category || (isWsAsset ? "Generator" : isTrailer ? "Trailer" : "Vehicle"),
          asset_kind: isWsAsset ? "workshop_asset" : isTrailer ? "trailer" : "vehicle",
          asset_type: isWsAsset ? (machine.category || "Generator") : "Generator",
          vehicle_code: machine.vehicle_code || generateVehicleCode(machine.category, undefined, existingCount ?? 0),
          name: machine.name,
          plate_number: machine.plate_number ?? "",
          serial_number: machine.serial_number ?? "",
          rated_power_capacity: machine.rated_power_capacity ?? "",
          purchase_date: machine.purchase_date ?? "",
          purchase_cost: machine.purchase_cost != null ? String(machine.purchase_cost) : "",
          make: machine.make ?? "",
          model: machine.model ?? "",
          year: machine.year != null ? String(machine.year) : "",
          vin: machine.vin ?? "",
          fuel_type: machine.fuel_type ?? "diesel",
          vehicle_type: machine.vehicle_type || (isWsAsset ? "plant_asset" : isTrailer ? "trailer" : "truck"),
          axle_configuration: (machine.axle_configuration || (isTrailer ? "trailer_tri" : "6x4")) as TruckLayoutConfigId,
          is_trailer: isTrailer,
          trailer_mode: trailerMode,
          linked_trailer_id: machine.linked_trailer_id ?? "",
          trailer_plate: machine.trailer_plate ?? "",
          trailer_make_model: machine.trailer_make_model ?? "",
          head_tank_capacity_l: machine.head_tank_capacity_l != null ? String(machine.head_tank_capacity_l) : (machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : ""),
          trailer_tank_capacity_l: machine.trailer_tank_capacity_l != null ? String(machine.trailer_tank_capacity_l) : "",
          total_tank_capacity_l: machine.total_tank_capacity_l != null ? String(machine.total_tank_capacity_l) : (machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : ""),
          tank_capacity_l: machine.tank_capacity_l != null ? String(machine.tank_capacity_l) : "",
          current_odometer_km: machine.current_odometer_km != null ? String(machine.current_odometer_km) : "",
          current_hours: machine.current_hours != null ? String(machine.current_hours) : "",
          auto_pm_enabled: Boolean(machine.auto_pm_enabled),
          auto_pm_hours_interval: machine.auto_pm_hours_interval != null ? String(machine.auto_pm_hours_interval) : "250",
          auto_pm_km_interval: machine.auto_pm_km_interval != null ? String(machine.auto_pm_km_interval) : "10000",
          home_depot: machine.installation_bay || machine.home_depot || "",
          status: machine.status,
          user_notes: machine.user_notes ?? "",
          telematics_imei: machine.telematics_imei ?? "",
        });
      } else {
        const isWs = isWorkshopAssetCategory(initialCategory) || initialCategory === "workshop_asset";
        const isTrailer = !isWs && initialCategory === "Trailer";
        const categoryName = isWs ? (WORKSHOP_ASSET_TYPES.some((w) => w.value === initialCategory) ? initialCategory : "Generator") : isTrailer ? "Trailer" : "Vehicle";
        const initialAssetType = isWs ? categoryName : "Generator";
        const matchedAssetType = WORKSHOP_ASSET_TYPES.find((w) => w.value === initialAssetType);

        setCustomMake(false);
        setForm({
          ...EMPTY_FORM,
          category: categoryName,
          asset_kind: isWs ? "workshop_asset" : isTrailer ? "trailer" : "vehicle",
          asset_type: initialAssetType,
          vehicle_code: generateVehicleCode(categoryName, undefined, existingCount ?? 0),
          is_trailer: isTrailer,
          vehicle_type: isWs ? "plant_asset" : isTrailer ? "trailer" : "truck",
          axle_configuration: isTrailer ? "trailer_tri" : "6x4",
          auto_pm_enabled: isWs ? true : false,
          auto_pm_hours_interval: matchedAssetType?.defaultHours || "250",
        });
      }
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, machine, initialCategory, existingCount]);

  const relevantMakes = useMemo(() => {
    const isTrailerCategory = form.category === "Trailer" || form.is_trailer;
    if (isTrailerCategory) {
      const trailers = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "trailer");
      const others = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category !== "trailer");
      return [...trailers, ...others];
    }
    if (form.vehicle_type === "bus") {
      const buses = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "bus");
      const trucks = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "truck");
      const trailers = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "trailer");
      return [...buses, ...trucks, ...trailers];
    }
    const trucks = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "truck");
    const buses = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "bus");
    const trailers = TANZANIA_COMMERCIAL_MAKES.filter((m) => m.category === "trailer");
    return [...trucks, ...buses, ...trailers];
  }, [form.category, form.is_trailer, form.vehicle_type]);

  const onPhotoSelected = (file: File | null) => {
    if (!file) { setPhotoFile(null); setPhotoPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large. Please keep it under 5 MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const updateHeadTank = (val: string) => {
    const headNum = Number(val) || 0;
    const trailerNum = form.trailer_mode !== "none" ? (Number(form.trailer_tank_capacity_l) || 0) : 0;
    const total = headNum + trailerNum;
    setForm((prev) => ({
      ...prev,
      head_tank_capacity_l: val,
      total_tank_capacity_l: total > 0 ? String(total) : (val ? val : ""),
      tank_capacity_l: total > 0 ? String(total) : (val ? val : ""),
    }));
  };

  const updateTrailerTank = (val: string) => {
    const headNum = Number(form.head_tank_capacity_l) || 0;
    const trailerNum = Number(val) || 0;
    const total = headNum + trailerNum;
    setForm((prev) => ({
      ...prev,
      trailer_tank_capacity_l: val,
      total_tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
      tank_capacity_l: total > 0 ? String(total) : (headNum > 0 ? String(headNum) : ""),
    }));
  };

  const onFleetTrailerSelect = (trailerId: string) => {
    if (!trailerId || trailerId === "none") {
      setForm((prev) => ({
        ...prev,
        trailer_mode: "none",
        linked_trailer_id: "",
        trailer_plate: "",
        trailer_make_model: "",
        trailer_tank_capacity_l: "",
        total_tank_capacity_l: prev.head_tank_capacity_l,
        tank_capacity_l: prev.head_tank_capacity_l,
      }));
      return;
    }

    const t = availableTrailers.find((x) => x.id === trailerId);
    if (!t) return;

    const trailerCap = t.total_tank_capacity_l || t.tank_capacity_l || 0;
    const headCap = Number(form.head_tank_capacity_l) || 0;
    const total = headCap + trailerCap;

    setForm((prev) => ({
      ...prev,
      trailer_mode: "fleet",
      linked_trailer_id: t.id,
      trailer_plate: t.plate_number || t.name,
      trailer_make_model: [t.make, t.model].filter(Boolean).join(" ") || t.name,
      trailer_tank_capacity_l: trailerCap > 0 ? String(trailerCap) : "",
      total_tank_capacity_l: total > 0 ? String(total) : prev.head_tank_capacity_l,
      tank_capacity_l: total > 0 ? String(total) : prev.head_tank_capacity_l,
    }));
  };

  const isWsAsset = form.asset_kind === "workshop_asset" || isWorkshopAssetCategory(form.category);
  const isTrailer = !isWsAsset && (form.asset_kind === "trailer" || form.is_trailer || form.category === "Trailer");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.name.trim()) {
      return toast.error(isWsAsset ? "Plant / Equipment asset name is required" : isTrailer ? "Trailer name is required" : "Vehicle name is required");
    }
    setSubmitting(true);

    try {
      let coverUrl: string | null = machine?.cover_image_url ?? null;
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.organisation_id}/covers/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("machine-docs")
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (upErr) throw upErr;
        coverUrl = path;
      }

      const hasTrailerHitch = !isWsAsset && !isTrailer && form.trailer_mode !== "none";

      const headCap = (isWsAsset || isTrailer)
        ? null
        : form.head_tank_capacity_l ? Number(form.head_tank_capacity_l) : null;

      const trailerCap = isTrailer
        ? (form.total_tank_capacity_l ? Number(form.total_tank_capacity_l) : null)
        : (hasTrailerHitch && form.trailer_tank_capacity_l ? Number(form.trailer_tank_capacity_l) : null);

      const totalCap = isWsAsset
        ? (form.tank_capacity_l ? Number(form.tank_capacity_l) : null)
        : isTrailer
        ? trailerCap
        : (form.total_tank_capacity_l ? Number(form.total_tank_capacity_l) : ((headCap || 0) + (trailerCap || 0) || null));

      // Build safe payload serialized into standard schema and metadata JSON
      const safePayload = serializeMachinePayload({
        vehicle_code: form.vehicle_code.trim() || null,
        name: form.name.trim(),
        plate_number: isWsAsset ? (form.plate_number.trim() || form.vehicle_code.trim() || null) : (form.plate_number.trim() || null),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        vin: isWsAsset ? (form.serial_number.trim() || form.vin.trim() || null) : (form.vin.trim() || null),
        category: form.category,
        fuel_type: isTrailer ? null : (form.fuel_type || null),
        tank_capacity_l: totalCap ?? headCap,
        current_odometer_km: isWsAsset ? null : (form.current_odometer_km ? Number(form.current_odometer_km) : null),
        current_hours: form.current_hours ? Number(form.current_hours) : null,
        home_depot: form.home_depot.trim() || null,
        status: form.status,
        cover_image_url: coverUrl,
        vehicle_type: isWsAsset ? "plant_asset" : isTrailer ? "trailer" : form.vehicle_type,
        axle_configuration: form.axle_configuration,
        is_trailer: isTrailer,
        linked_trailer_id: hasTrailerHitch && form.trailer_mode === "fleet" ? form.linked_trailer_id : null,
        linked_trailer_plate: hasTrailerHitch ? (form.trailer_plate.trim() || null) : null,
        linked_trailer_name: hasTrailerHitch ? (form.trailer_make_model.trim() || null) : null,
        head_tank_capacity_l: headCap,
        trailer_tank_capacity_l: trailerCap,
        total_tank_capacity_l: totalCap,
        auto_pm_enabled: form.auto_pm_enabled,
        auto_pm_hours_interval: form.auto_pm_hours_interval ? Number(form.auto_pm_hours_interval) : null,
        auto_pm_km_interval: isWsAsset ? null : (form.auto_pm_km_interval ? Number(form.auto_pm_km_interval) : null),
        user_notes: form.user_notes.trim() || null,
        telematics_imei: form.telematics_imei.trim() || null,
        existing_telematics: (machine as any)?.telematics_obj ?? undefined,

        // Workshop Asset details
        is_workshop_asset: isWsAsset,
        asset_type: isWsAsset ? (form.category.toLowerCase().replace(/\s+/g, "_")) : null,
        serial_number: form.serial_number.trim() || null,
        rated_power_capacity: form.rated_power_capacity.trim() || null,
        purchase_date: form.purchase_date.trim() || null,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        installation_bay: form.home_depot.trim() || null,
      });

      let savedMachineId = machine?.id;
      let createdRecord: any = null;

      if (machine) {
        const { error } = await supabase.from("machines").update(safePayload).eq("id", machine.id);
        if (error) throw error;
      } else {
        const { data: newMach, error } = await supabase.from("machines").insert({
          ...safePayload,
          organisation_id: profile.organisation_id,
        }).select("id, name, plate_number, registration_number, current_odometer_km, current_hours, category, make, model, year, serial_number, vin").single();
        if (error) throw error;
        savedMachineId = newMach.id;
        createdRecord = newMach;
      }

      // Auto-create or sync Preventive Maintenance (PM) Schedule if enabled
      if (savedMachineId && form.auto_pm_enabled && form.auto_pm_hours_interval) {
        const intervalHours = Number(form.auto_pm_hours_interval);
        const curHours = form.current_hours ? Number(form.current_hours) : 0;
        const nextDueHours = curHours + intervalHours;

        // Check if an auto-PM schedule already exists for this machine
        const { data: existingSchedules } = await supabase
          .from("service_schedules")
          .select("id")
          .eq("machine_id", savedMachineId)
          .eq("name", "Automated PM Interval Service")
          .limit(1);

        const pmInstructions = isWsAsset
          ? `Automated PM alert for ${form.name}: triggered every ${intervalHours} operating runtime hours. Inspect filters, engine oil/coolant, electrical connections, drive belts, and safety cutouts.`
          : `Automated PM alert: triggered after ${intervalHours} operating hours or scheduled interval. Inspect fluids, filters, and safety systems.`;

        if (existingSchedules && existingSchedules.length > 0) {
          await supabase.from("service_schedules").update({
            interval_hours: intervalHours,
            next_due_hours: nextDueHours,
            instructions: pmInstructions,
            status: "active",
          }).eq("id", existingSchedules[0].id);
        } else {
          const estDate = new Date();
          estDate.setDate(estDate.getDate() + 90);
          await supabase.from("service_schedules").insert({
            organisation_id: profile.organisation_id,
            machine_id: savedMachineId,
            name: "Automated PM Interval Service",
            service_type: "small_service",
            interval_hours: intervalHours,
            next_due_hours: nextDueHours,
            interval_days: 90,
            next_due_date: estDate.toISOString().slice(0, 10),
            status: "active",
            instructions: pmInstructions,
          });
        }
      }

      // Status history sync
      if (machine && form.status !== machine.status) {
        await supabase.from("machine_status_history").insert({
          organisation_id: profile.organisation_id,
          machine_id: machine.id,
          from_status: machine.status,
          to_status: form.status,
          reason: "Updated via vehicle & asset form",
          changed_by: user?.id ?? null,
        });
      }

      toast.success(
        machine
          ? (isWsAsset ? "Plant / Equipment asset updated" : isTrailer ? "Trailer updated" : "Vehicle updated")
          : (isWsAsset ? "Plant / Equipment asset registered" : isTrailer ? "Trailer registered" : "Vehicle registered")
      );
      onOpenChange(false);
      onSaved(createdRecord);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save asset";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWsAsset ? (
              <Wrench className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : isTrailer ? (
              <Container className="h-5 w-5 text-emerald-600" />
            ) : (
              <Truck className="h-5 w-5 text-primary" />
            )}
            {machine
              ? (isWsAsset ? "Edit Plant / Equipment Asset" : isTrailer ? "Edit Independent Trailer" : "Edit Vehicle")
              : (isWsAsset ? "Register Plant / Equipment Asset" : isTrailer ? "Add Independent Trailer" : "Add Vehicle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Asset Classification Selector (when adding new) */}
          {!machine && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Asset Classification & Registry Type
              </Label>
              <div className={`grid grid-cols-1 ${isEnterprise ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2`}>
                <Button
                  type="button"
                  variant={form.asset_kind === "vehicle" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2 cursor-pointer h-10 text-xs font-medium"
                  onClick={() => {
                    const currentNum = form.vehicle_code.match(/\d+$/)?.[0] ?? String((existingCount ?? 0) + 1).padStart(3, "0");
                    setForm((prev) => ({
                      ...prev,
                      category: "Vehicle",
                      asset_kind: "vehicle",
                      vehicle_code: `TRK-${currentNum.padStart(3, "0")}`,
                      is_trailer: false,
                      vehicle_type: "truck",
                      axle_configuration: "6x4",
                    }));
                  }}
                >
                  <Truck className="h-4 w-4" /> Power Unit / Truck
                </Button>
                <Button
                  type="button"
                  variant={form.asset_kind === "trailer" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2 cursor-pointer h-10 text-xs font-medium"
                  onClick={() => {
                    const currentNum = form.vehicle_code.match(/\d+$/)?.[0] ?? String((existingCount ?? 0) + 1).padStart(3, "0");
                    setForm((prev) => ({
                      ...prev,
                      category: "Trailer",
                      asset_kind: "trailer",
                      vehicle_code: `TRL-${currentNum.padStart(3, "0")}`,
                      is_trailer: true,
                      vehicle_type: "trailer",
                      axle_configuration: "trailer_tri",
                    }));
                  }}
                >
                  <Container className="h-4 w-4" /> Independent Trailer
                </Button>
                {isEnterprise && (
                  <Button
                    type="button"
                    variant={form.asset_kind === "workshop_asset" ? "default" : "outline"}
                    className={`flex items-center justify-center gap-2 cursor-pointer h-10 text-xs font-medium ${
                      form.asset_kind === "workshop_asset"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    }`}
                    onClick={() => {
                      const currentNum = form.vehicle_code.match(/\d+$/)?.[0] ?? String((existingCount ?? 0) + 1).padStart(3, "0");
                      setForm((prev) => ({
                        ...prev,
                        category: "Generator",
                        asset_kind: "workshop_asset",
                        asset_type: "Generator",
                        vehicle_code: `GEN-${currentNum.padStart(3, "0")}`,
                        is_trailer: false,
                        vehicle_type: "plant_asset",
                        auto_pm_enabled: true,
                        auto_pm_hours_interval: "250",
                      }));
                    }}
                  >
                    <Wrench className="h-4 w-4" /> Workshop & Plant (Slide 19)
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Photo Upload */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{isWsAsset ? "Asset Photo" : isTrailer ? "Trailer Photo" : "Vehicle Photo"}</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Selected asset" className="h-full w-full object-cover" />
                  ) : (
                    <CoverImage
                      value={machine?.cover_image_url}
                      alt={form.name || "Asset"}
                      className="h-full w-full object-cover"
                      fallback={
                        isWsAsset ? (
                          <Wrench className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : isTrailer ? (
                          <Container className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Truck className="h-5 w-5 text-muted-foreground" />
                        )
                      }
                    />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span>{photoFile ? photoFile.name : "Choose photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            {/* WORKSHOP & PLANT ASSET FORM (SLIDE 19) */}
            {isWsAsset ? (
              <>
                {/* Equipment Subtype Selector */}
                <div className="space-y-1.5 sm:col-span-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                      <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Plant Equipment Subtype (Slide 19) *
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Stationary & workshop asset registration</span>
                  </div>
                  <Select
                    value={form.category}
                    onValueChange={(val) => {
                      const typeMatch = WORKSHOP_ASSET_TYPES.find((w) => w.value === val);
                      const prefix = typeMatch?.defaultCode || "AST";
                      const currentNum = form.vehicle_code.match(/\d+$/)?.[0] ?? String((existingCount ?? 0) + 1).padStart(3, "0");
                      setForm((prev) => ({
                        ...prev,
                        category: val,
                        asset_type: val,
                        vehicle_code: `${prefix}-${currentNum.padStart(3, "0")}`,
                        auto_pm_hours_interval: typeMatch?.defaultHours || "250",
                      }));
                    }}
                  >
                    <SelectTrigger className="border-emerald-500/40 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WORKSHOP_ASSET_TYPES.map((w) => {
                        const Icon = w.icon;
                        return (
                          <SelectItem key={w.value} value={w.value}>
                            <div className="flex items-center gap-2 py-0.5">
                              <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="font-medium text-xs">{w.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Name & Asset Tag / Code */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Plant / Equipment Name *</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Caterpillar 500kVA Standby Generator #1"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Asset Tag / Code *</Label>
                        <button
                          type="button"
                          onClick={() => {
                            const nextCode = generateVehicleCode(form.category, undefined, (existingCount ?? 0) + Math.floor(1 + Math.random() * 20));
                            setForm((prev) => ({ ...prev, vehicle_code: nextCode }));
                          }}
                          className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                          title="Generate next ID"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> Auto-Gen
                        </button>
                      </div>
                      <Input
                        value={form.vehicle_code}
                        onChange={(e) => setForm({ ...form, vehicle_code: e.target.value.toUpperCase() })}
                        placeholder="GEN-001"
                        className="font-mono font-bold text-foreground tracking-wider uppercase h-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Serial Number & Make / Manufacturer */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Serial Number / Nameplate S/N</Label>
                    <span className="text-[10px] text-muted-foreground">Manufacturer tag</span>
                  </div>
                  <Input
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    placeholder="e.g. CAT-C15-89421A"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Make / Manufacturer</Label>
                  <Input
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    placeholder="e.g. Caterpillar, Atlas Copco, Ingersoll Rand"
                  />
                </div>

                {/* Model & Year */}
                <div className="space-y-1.5">
                  <Label>Model / Specification</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. C15 Acert / GA37 VSD / 8FGCU25"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Year of Manufacture</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="e.g. 2021"
                  />
                </div>

                {/* Power Source & Rated Power / Capacity */}
                <div className="space-y-1.5">
                  <Label>Power Source / Prime Mover</Label>
                  <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_POWER_SOURCES.map((ps) => (
                        <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Rated Power / Capacity</Label>
                    <span className="text-[10px] text-muted-foreground font-normal">e.g. kVA, CFM, m³/h, Tons</span>
                  </div>
                  <Input
                    value={form.rated_power_capacity}
                    onChange={(e) => setForm({ ...form, rated_power_capacity: e.target.value })}
                    placeholder="e.g. 500 kVA (400 kW) or 7.5 bar 350 CFM"
                  />
                </div>

                {/* Day / Fuel Tank Capacity & Current Operating Hours */}
                <div className="space-y-1.5">
                  <Label>Day / Fuel Tank Capacity (L)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.tank_capacity_l}
                    onChange={(e) => setForm({ ...form, tank_capacity_l: e.target.value, total_tank_capacity_l: e.target.value })}
                    placeholder="e.g. 1000 (leave blank if electric)"
                  />
                  <span className="text-[10px] text-muted-foreground">For diesel gensets, boilers & diesel forklifts</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-primary font-semibold">
                    <Clock className="h-3.5 w-3.5" /> Current Operating Hours (hrs) *
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.current_hours}
                    onChange={(e) => setForm({ ...form, current_hours: e.target.value })}
                    placeholder="e.g. 1450"
                  />
                  <span className="text-[10px] text-muted-foreground">Meter reading for maintenance scheduling</span>
                </div>

                {/* Installation Location / Bay / Depot */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Installation Location / Plant Room / Depot Bay</Label>
                  <Input
                    value={form.home_depot}
                    onChange={(e) => setForm({ ...form, home_depot: e.target.value })}
                    placeholder="e.g. Dar es Salaam Depot - Main Generator Room / Workshop Bay 2"
                  />
                </div>

                {/* Purchase Date & Purchase Cost */}
                <div className="space-y-1.5">
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Purchase Cost (TZS / USD)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.purchase_cost}
                    onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                    placeholder="e.g. 45000000"
                  />
                </div>

                {/* Operational Status */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Operational Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active / Operational</SelectItem>
                      <SelectItem value="workshop">In Workshop</SelectItem>
                      <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="breakdown">Breakdown</SelectItem>
                      <SelectItem value="out_of_service">Out of Service</SelectItem>
                      <SelectItem value="retired">Retired / Decommissioned</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Automated PM Trigger (Hours based for stationary plant) */}
                <div className="sm:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <Label className="text-sm font-semibold cursor-pointer" htmlFor="auto-pm-switch">
                          Automated Runtime PM Trigger
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically track operating hours and create PM alerts / job cards (e.g., 250h or 500h service interval).
                      </p>
                    </div>
                    <Switch
                      id="auto-pm-switch"
                      checked={form.auto_pm_enabled}
                      onCheckedChange={(checked) => setForm({ ...form, auto_pm_enabled: checked })}
                    />
                  </div>

                  {form.auto_pm_enabled && (
                    <div className="space-y-1.5 pt-2 border-t border-emerald-500/20">
                      <Label className="text-xs font-medium">Service Trigger Every (Operating Hours)</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form.auto_pm_hours_interval}
                        onChange={(e) => setForm({ ...form, auto_pm_hours_interval: e.target.value })}
                        placeholder="e.g. 250 or 500"
                      />
                      <span className="text-[10px] text-muted-foreground">Alerts when machine reaches runtime threshold (e.g. oil, filters & calibration)</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ROAD VEHICLE & TRAILER FORM */
              <>
                {/* Name & Asset ID / Code */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>{isTrailer ? "Trailer Name / Unit ID *" : "Vehicle Name *"}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={isTrailer ? "e.g. Tanker Semi-Trailer #01 (BPW)" : "e.g. Scania R500 Prime Mover"}
                        maxLength={100}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">{isTrailer ? "Trailer ID / Code *" : "Asset ID / Code *"}</Label>
                        <button
                          type="button"
                          onClick={() => {
                            const nextCode = generateVehicleCode(
                              form.category,
                              undefined,
                              (existingCount ?? 0) + Math.floor(1 + Math.random() * 20)
                            );
                            setForm((prev) => ({ ...prev, vehicle_code: nextCode }));
                          }}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                          title="Generate next ID"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> Auto-Gen
                        </button>
                      </div>
                      <Input
                        value={form.vehicle_code}
                        onChange={(e) => setForm({ ...form, vehicle_code: e.target.value.toUpperCase() })}
                        placeholder={isTrailer ? "TRL-001" : "TRK-001"}
                        className="font-mono font-bold text-foreground tracking-wider uppercase h-10"
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">{isTrailer ? "e.g. TRL-001, TRL-012" : "e.g. TRK-001, FLT-042"}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Type (Only for power units) */}
                {!isTrailer && (
                  <div className="space-y-1.5">
                    <Label>Vehicle Type</Label>
                    <Select
                      value={form.vehicle_type}
                      onValueChange={(v) => {
                        let defaultAxle: TruckLayoutConfigId = "6x4";
                        if (v === "rigid") defaultAxle = "4x2";
                        else if (v === "rigid_trailer") defaultAxle = "4x2_trailer";
                        else if (v === "van_pickup") defaultAxle = "4_wheel";
                        else if (v === "prime_mover" || v === "tanker" || v === "truck") defaultAxle = "6x4";

                        setForm((prev) => ({
                          ...prev,
                          vehicle_type: v,
                          axle_configuration: defaultAxle,
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.filter((vt) => vt.value !== "trailer").map((vt) => (
                          <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Plate Number */}
                <div className="space-y-1.5">
                  <Label>{isTrailer ? "Trailer Plate Number *" : "Plate Number"}</Label>
                  <Input
                    value={form.plate_number}
                    onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                    placeholder={isTrailer ? "e.g. T 892 DFE" : "e.g. T 123 ABC"}
                  />
                </div>

                {/* Axle Configuration (Key feature for tyre management) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-primary font-semibold flex items-center gap-1.5">
                      <Layers className="h-4 w-4" /> Axle & Tyre Configuration *
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Auto-binds tyre positions in Tyre Management</span>
                  </div>
                  <Select
                    value={form.axle_configuration}
                    onValueChange={(v) => setForm({ ...form, axle_configuration: v as TruckLayoutConfigId })}
                  >
                    <SelectTrigger className="border-primary/40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AXLE_CONFIG_OPTIONS.filter((opt) => {
                        if (isTrailer) return opt.value.startsWith("trailer");
                        return !opt.value.startsWith("trailer");
                      }).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col text-left py-0.5">
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="workshop">In Workshop</SelectItem>
                      <SelectItem value="under_maintenance">Under maintenance</SelectItem>
                      <SelectItem value="breakdown">Breakdown</SelectItem>
                      <SelectItem value="out_of_service">Out of service</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Make */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Make *</Label>
                    {form.make && (
                      <span className="text-[10px] font-mono text-primary font-medium">
                        {form.make}
                      </span>
                    )}
                  </div>
                  <Select
                    value={
                      customMake
                        ? "OTHER"
                        : (relevantMakes.some(
                            (m) => m.name.toLowerCase() === (form.make || "").trim().toLowerCase()
                          )
                            ? relevantMakes.find(
                                (m) => m.name.toLowerCase() === (form.make || "").trim().toLowerCase()
                              )!.name
                            : (form.make ? "OTHER" : ""))
                    }
                    onValueChange={(val) => {
                      if (val === "OTHER") {
                        setCustomMake(true);
                      } else {
                        setCustomMake(false);
                        setForm({ ...form, make: val });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isTrailer ? "Select Trailer Make..." : "Select Truck / Bus Make..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {isTrailer
                          ? "Common Trailer Makes (Tanzania)"
                          : (form.vehicle_type === "bus"
                              ? "Common Bus Makes (Tanzania)"
                              : "Common Truck Makes (Tanzania)")}
                      </div>
                      {relevantMakes.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          <div className="flex items-center justify-between gap-3 w-full py-0.5">
                            <span className="font-medium text-xs">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground">({m.category})</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="OTHER">
                        <span className="font-semibold text-primary text-xs">Other / Custom Make...</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {customMake && (
                    <div className="space-y-1 mt-1.5">
                      <Input
                        value={form.make}
                        onChange={(e) => setForm({ ...form, make: e.target.value })}
                        placeholder="Enter custom make (e.g. Kenworth, Peterbilt, Sinotruk Sitrak)"
                        className="text-xs"
                        autoFocus
                      />
                      <p className="text-[10px] text-muted-foreground">Type custom or unlisted vehicle make</p>
                    </div>
                  )}
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={isTrailer ? "e.g. 40,000L Fuel Tanker / Flatbed 40ft" : "e.g. R500 / Actros 3340"}
                  />
                </div>

                {/* Year */}
                <div className="space-y-1.5">
                  <Label>Year</Label>
                  <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2022" />
                </div>

                {/* VIN / Chassis */}
                <div className="space-y-1.5">
                  <Label>VIN / Chassis Number</Label>
                  <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
                </div>

                {/* GPS Telematics Tracker IMEI */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-primary" /> GPS Tracker IMEI
                  </Label>
                  <Input
                    value={form.telematics_imei}
                    onChange={(e) => setForm({ ...form, telematics_imei: e.target.value })}
                    placeholder="e.g. 863656045600231"
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Auto-syncs live odometer, speed, and GPS location from Trakzee</p>
                </div>

                {/* Fuel Type (Trucks only) */}
                {!isTrailer && (
                  <div className="space-y-1.5">
                    <Label>Fuel Type</Label>
                    <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FUEL_TYPES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Odometer */}
                <div className="space-y-1.5">
                  <Label>{isTrailer ? "Approx. Distance Run (km)" : "Current Odometer (km)"}</Label>
                  <Input type="number" step="any" value={form.current_odometer_km} onChange={(e) => setForm({ ...form, current_odometer_km: e.target.value })} placeholder="e.g. 120500" />
                </div>

                {/* Operating Hours (Engine runtime) */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Current Operating Hours (hrs)
                  </Label>
                  <Input type="number" step="any" value={form.current_hours} onChange={(e) => setForm({ ...form, current_hours: e.target.value })} placeholder="e.g. 2450" />
                </div>

                {/* Automated PM Maintenance Notifications */}
                <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold cursor-pointer" htmlFor="auto-pm-switch">
                          Automated Preventive Maintenance (PM) Trigger
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically track runtime hours or distance, and notify maintenance when this vehicle needs service.
                      </p>
                    </div>
                    <Switch
                      id="auto-pm-switch"
                      checked={form.auto_pm_enabled}
                      onCheckedChange={(checked) => setForm({ ...form, auto_pm_enabled: checked })}
                    />
                  </div>

                  {form.auto_pm_enabled && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-primary/10">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Service Trigger Every (Hours)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={form.auto_pm_hours_interval}
                          onChange={(e) => setForm({ ...form, auto_pm_hours_interval: e.target.value })}
                          placeholder="e.g. 250 or 500"
                        />
                        <span className="text-[10px] text-muted-foreground">Alerts when machine reaches runtime threshold</span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Service Trigger Every (Kilometers)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={form.auto_pm_km_interval}
                          onChange={(e) => setForm({ ...form, auto_pm_km_interval: e.target.value })}
                          placeholder="e.g. 10000 or 15000"
                        />
                        <span className="text-[10px] text-muted-foreground">Optional distance interval for highway hauls</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Home Depot */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Home Depot / Base Station</Label>
                  <Input value={form.home_depot} onChange={(e) => setForm({ ...form, home_depot: e.target.value })} placeholder="e.g. Dar es Salaam Depot / Kurasini Yard" />
                </div>

                {/* Trailer Tank Capacity (for independent trailer) */}
                {isTrailer && (
                  <div className="sm:col-span-2 rounded-xl border border-border bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-semibold text-foreground">Trailer Tank / Cargo Capacity</h4>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tank Capacity (Liters)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={form.total_tank_capacity_l}
                          onChange={(e) => setForm({ ...form, total_tank_capacity_l: e.target.value, tank_capacity_l: e.target.value })}
                          placeholder="e.g. 40000"
                        />
                        <span className="text-[10px] text-muted-foreground">For tanker trailers (leave blank if flatbed/dry cargo)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Truck Trailer Hitching & Multi-Tank Section (for power units only) */}
                {!isTrailer && (
                  <div className="sm:col-span-2 rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" /> Independent Trailer Hitching & Tanks
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Hitch an independent fleet trailer or configure head + trailer tank capacities.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Hitch Independent Trailer</Label>
                        <Select
                          value={form.trailer_mode === "fleet" ? form.linked_trailer_id : form.trailer_mode}
                          onValueChange={(v) => {
                            if (v === "none") {
                              onFleetTrailerSelect("none");
                            } else if (v === "manual") {
                              setForm((prev) => ({
                                ...prev,
                                trailer_mode: "manual",
                                linked_trailer_id: "",
                              }));
                            } else {
                              onFleetTrailerSelect(v);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select trailer attachment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">No Trailer (Bobtail / Solo Unit)</span>
                            </SelectItem>
                            {availableTrailers
                              .filter((t) => !machine || t.id !== machine.id)
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-primary">[{t.plate_number || "NO PLATE"}]</span>
                                    <span>{t.name}</span>
                                    {t.total_tank_capacity_l ? (
                                      <span className="text-xs text-muted-foreground">({formatNumber(t.total_tank_capacity_l)}L tank)</span>
                                    ) : null}
                                  </div>
                                </SelectItem>
                              ))}
                            <SelectItem value="manual">
                              <span>External / Custom Trailer (Manual Plate Entry)</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.trailer_mode === "manual" && (
                        <div className="grid gap-3 sm:grid-cols-2 pt-2 bg-background p-3 rounded-lg border border-dashed">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Trailer Plate Number *</Label>
                            <Input
                              value={form.trailer_plate}
                              onChange={(e) => setForm({ ...form, trailer_plate: e.target.value })}
                              placeholder="e.g. T 892 DFE"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Trailer Description</Label>
                            <Input
                              value={form.trailer_make_model}
                              onChange={(e) => setForm({ ...form, trailer_make_model: e.target.value })}
                              placeholder="e.g. 40,000L Tri-Axle Tanker"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tank Capacities Calculation */}
                      <div className="grid gap-3 sm:grid-cols-3 pt-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Head Tank (L)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={form.head_tank_capacity_l}
                            onChange={(e) => updateHeadTank(e.target.value)}
                            placeholder="e.g. 450"
                            className="h-9 text-sm"
                          />
                          <span className="text-[10px] text-muted-foreground">Tractor / Prime mover</span>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Trailer Tank (L)</Label>
                          <Input
                            type="number"
                            step="any"
                            disabled={form.trailer_mode === "none"}
                            value={form.trailer_tank_capacity_l}
                            onChange={(e) => updateTrailerTank(e.target.value)}
                            placeholder={form.trailer_mode !== "none" ? "e.g. 40000" : "Hitch trailer first"}
                            className="h-9 text-sm"
                          />
                          <span className="text-[10px] text-muted-foreground">Trailer payload tank</span>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-primary">Total Tank Capacity (L)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={form.total_tank_capacity_l}
                            onChange={(e) => setForm({ ...form, total_tank_capacity_l: e.target.value, tank_capacity_l: e.target.value })}
                            placeholder="e.g. 40450"
                            className="h-9 text-sm font-semibold border-primary/40 bg-background"
                          />
                          <span className="text-[10px] text-muted-foreground">Auto-sum: Head + Trailer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {machine
                ? t.common.save
                : (isWsAsset ? "Register Plant / Equipment" : isTrailer ? "Add Independent Trailer" : t.fleet.addVehicle)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
