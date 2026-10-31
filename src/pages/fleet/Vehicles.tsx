import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Fuel
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { MachineQrDialog } from "@/components/MachineQrDialog";
import { BulkImporterModal } from "@/components/BulkImporterModal";
import {
  SAFE_MACHINE_COLUMNS,
  parseMachine,
  serializeMachinePayload,
  type FleetVehicle,
  AXLE_CONFIG_OPTIONS
} from "@/lib/fleet-metadata";
import type { TruckLayoutConfigId } from "@/lib/fleet-constants";

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

const EMPTY_FORM = {
  category: "Vehicle" as "Vehicle" | "Trailer",
  name: "",
  plate_number: "",
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
  home_depot: "",
  status: "active",
  user_notes: "",
};

export default function Vehicles() {
  const { profile } = useAuth();
  const { canWrite } = useUserRole();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [assetTab, setAssetTab] = useState<"all" | "vehicles" | "trailers">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [initialCategory, setInitialCategory] = useState<"Vehicle" | "Trailer">("Vehicle");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrMachine, setQrMachine] = useState<FleetVehicle | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
        .in("category", ["Vehicle", "Trailer"])
        .order("name"),
      supabase.from("trips").select("machine_id, driver_id, status, start_at").order("start_at", { ascending: false }),
      supabase.from("service_schedules").select("machine_id, next_due_date").order("next_due_date", { nullsFirst: false }),
      supabase.from("vehicle_documents").select("machine_id, expires_on").order("expires_on", { nullsFirst: false }),
      supabase.from("drivers").select("id, full_name"),
    ]);

    const err = e1 || e2 || e3 || e4 || e5;
    if (err) toast.error(err.message);

    const parsedMachines = (m ?? []).map(parseMachine);
    setMachines(parsedMachines);
    setTrips((t ?? []) as Trip[]);
    setSchedules((s ?? []) as Schedule[]);
    setDocs((doc ?? []) as VehicleDoc[]);
    setDrivers((d ?? []) as Driver[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d.full_name])), [drivers]);

  // Trailers registered in fleet
  const fleetTrailers = useMemo(() => machines.filter((m) => m.is_trailer || m.category === "Trailer"), [machines]);
  const powerUnits = useMemo(() => machines.filter((m) => !m.is_trailer && m.category !== "Trailer"), [machines]);

  // Current driver per vehicle: driver on the latest in_progress trip, else the most recent trip's driver.
  const currentDriver = useMemo(() => {
    const map = new Map<string, { name: string; onTrip: boolean }>();
    for (const t of trips) {
      if (map.has(t.machine_id)) continue;
      if (!t.driver_id) continue;
      map.set(t.machine_id, { name: driverMap.get(t.driver_id) ?? "—", onTrip: t.status === "in_progress" });
    }
    return map;
  }, [trips, driverMap]);

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
      if (assetTab === "vehicles" && (m.is_trailer || m.category === "Trailer")) return false;
      if (assetTab === "trailers" && !m.is_trailer && m.category !== "Trailer") return false;
      if (status !== "all" && m.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !(m.plate_number ?? "").toLowerCase().includes(q) &&
          !(m.trailer_plate ?? "").toLowerCase().includes(q) &&
          !(m.make ?? "").toLowerCase().includes(q) &&
          !(m.model ?? "").toLowerCase().includes(q) &&
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
          <h1 className="text-2xl font-semibold tracking-tight">{t.fleet.vehiclesTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Manage your fleet of power units, trucks, and independent trailers with axle configurations & fuel capacities.
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel / CSV
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
              <Plus className="mr-2 h-4 w-4" /> {t.fleet.addVehicle}
            </Button>
          </div>
        )}
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

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Hitched Units</span>
            <Link2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {powerUnits.filter((p) => p.has_trailer).length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Trucks with trailers attached</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Active in Fleet</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {machines.filter((m) => m.status === "active").length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Operational units ready for service</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={assetTab} onValueChange={(v) => setAssetTab(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All Assets ({machines.length})</TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Trucks ({powerUnits.length})
            </TabsTrigger>
            <TabsTrigger value="trailers" className="flex items-center gap-1.5">
              <Container className="h-3.5 w-3.5" /> Trailers ({fleetTrailers.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, name, axle..." className="pl-9 h-9 text-sm" />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t.fleet.allStatuses}</option>
            <option value="active">Active</option>
            <option value="under_maintenance">Under maintenance</option>
            <option value="retired">Retired</option>
          </select>
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium flex items-center justify-between">
            <span>Fleet Registry ({filtered.length})</span>
            <span className="text-xs text-muted-foreground">Vehicles & Independent Trailers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
                <tr>
                  <th className="px-5 py-3 font-medium">Asset & Classification</th>
                  <th className="px-5 py-3 font-medium">Plate & Hitched Unit</th>
                  <th className="px-5 py-3 font-medium">Axle Configuration</th>
                  <th className="px-5 py-3 font-medium">Tank (Head / Trailer / Total)</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDriver}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colOdometer}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colNextService}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDocs}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colDepot}</th>
                  <th className="px-5 py-3 font-medium">{t.fleet.colStatus}</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const isTrailer = m.is_trailer || m.category === "Trailer";
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
                              fallback={isTrailer ? <Container className="h-4 w-4 text-emerald-600" /> : <Truck className="h-4 w-4 text-muted-foreground" />}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link to={`/machines/${m.id}`} className="font-medium hover:underline text-foreground">
                                {m.name}
                              </Link>
                              {isTrailer ? (
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
                              {[m.make, m.model, m.year].filter(Boolean).join(" · ") || (isTrailer ? "Semi-Trailer" : "Vehicle")}
                              {!isTrailer && m.vehicle_type && (
                                <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium capitalize text-muted-foreground border">
                                  {m.vehicle_type.replace("_", " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plate & Hitched Unit */}
                      <td className="px-5 py-3">
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
                      </td>

                      {/* Axle Configuration */}
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">
                          {axleMatch ? axleMatch.label : m.axle_configuration || "6x4"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {axleMatch ? `${axleMatch.tyreCount} tyre positions` : "Standard configuration"}
                        </div>
                      </td>

                      {/* Tank Capacity (Head / Trailer / Total) */}
                      <td className="px-5 py-3">
                        {totalTank ? (
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1">
                              <Fuel className="h-3.5 w-3.5 text-primary" />
                              <span>{formatNumber(totalTank)} L</span>
                              <span className="text-[10px] text-muted-foreground font-normal">Total</span>
                            </div>
                            {hasMultiTank && (m.head_tank_capacity_l != null || m.trailer_tank_capacity_l != null) && (
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
                        {isTrailer ? (
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

                      {/* Odometer */}
                      <td className="px-5 py-3 text-muted-foreground">
                        {m.current_odometer_km != null ? `${formatNumber(m.current_odometer_km)} km` : "—"}
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
        onSaved={load}
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
          currentHours={qrMachine.current_odometer_km}
          category={qrMachine.category}
          organisationName={profile?.organisation_id}
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

function VehicleDialog({
  open,
  onOpenChange,
  machine,
  initialCategory = "Vehicle",
  availableTrailers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machine: FleetVehicle | null;
  initialCategory?: "Vehicle" | "Trailer";
  availableTrailers: FleetVehicle[];
  onSaved: () => void;
}) {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (machine) {
        const isTrailer = machine.is_trailer || machine.category === "Trailer";
        let trailerMode: "none" | "fleet" | "manual" = "none";
        if (machine.linked_trailer_id) {
          trailerMode = "fleet";
        } else if (machine.trailer_plate) {
          trailerMode = "manual";
        }

        setForm({
          category: (machine.category === "Trailer" ? "Trailer" : "Vehicle") as "Vehicle" | "Trailer",
          name: machine.name,
          plate_number: machine.plate_number ?? "",
          make: machine.make ?? "",
          model: machine.model ?? "",
          year: machine.year != null ? String(machine.year) : "",
          vin: machine.vin ?? "",
          fuel_type: machine.fuel_type ?? "diesel",
          vehicle_type: machine.vehicle_type || (isTrailer ? "trailer" : "truck"),
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
          home_depot: machine.home_depot ?? "",
          status: machine.status,
          user_notes: machine.user_notes ?? "",
        });
      } else {
        const isTrailer = initialCategory === "Trailer";
        setForm({
          ...EMPTY_FORM,
          category: initialCategory,
          is_trailer: isTrailer,
          vehicle_type: isTrailer ? "trailer" : "truck",
          axle_configuration: isTrailer ? "trailer_tri" : "6x4",
        });
      }
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, machine, initialCategory]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.name.trim()) return toast.error(form.is_trailer ? "Trailer name is required" : "Vehicle name is required");
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

      const isTrailer = form.is_trailer || form.category === "Trailer";
      const hasTrailerHitch = !isTrailer && form.trailer_mode !== "none";

      const headCap = isTrailer
        ? null
        : form.head_tank_capacity_l ? Number(form.head_tank_capacity_l) : null;

      const trailerCap = isTrailer
        ? (form.total_tank_capacity_l ? Number(form.total_tank_capacity_l) : null)
        : (hasTrailerHitch && form.trailer_tank_capacity_l ? Number(form.trailer_tank_capacity_l) : null);

      const totalCap = isTrailer
        ? trailerCap
        : (form.total_tank_capacity_l ? Number(form.total_tank_capacity_l) : ((headCap || 0) + (trailerCap || 0) || null));

      // Build safe payload serialized into standard schema and metadata JSON
      const safePayload = serializeMachinePayload({
        name: form.name.trim(),
        plate_number: form.plate_number.trim() || null,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        vin: form.vin.trim() || null,
        category: form.category,
        fuel_type: isTrailer ? null : (form.fuel_type || null),
        tank_capacity_l: totalCap ?? headCap,
        current_odometer_km: form.current_odometer_km ? Number(form.current_odometer_km) : null,
        home_depot: form.home_depot.trim() || null,
        status: form.status,
        cover_image_url: coverUrl,
        vehicle_type: isTrailer ? "trailer" : form.vehicle_type,
        axle_configuration: form.axle_configuration,
        is_trailer: isTrailer,
        linked_trailer_id: hasTrailerHitch && form.trailer_mode === "fleet" ? form.linked_trailer_id : null,
        linked_trailer_plate: hasTrailerHitch ? (form.trailer_plate.trim() || null) : null,
        linked_trailer_name: hasTrailerHitch ? (form.trailer_make_model.trim() || null) : null,
        head_tank_capacity_l: headCap,
        trailer_tank_capacity_l: trailerCap,
        total_tank_capacity_l: totalCap,
        user_notes: form.user_notes.trim() || null,
      });

      const { error } = machine
        ? await supabase.from("machines").update(safePayload).eq("id", machine.id)
        : await supabase.from("machines").insert({
            ...safePayload,
            organisation_id: profile.organisation_id,
          });

      if (error) throw error;

      // Status history sync
      if (machine && form.status !== machine.status) {
        await supabase.from("machine_status_history").insert({
          organisation_id: profile.organisation_id,
          machine_id: machine.id,
          from_status: machine.status,
          to_status: form.status,
          reason: "Updated via fleet asset form",
          changed_by: user?.id ?? null,
        });
      }

      toast.success(machine ? (isTrailer ? "Trailer updated" : "Vehicle updated") : (isTrailer ? "Trailer registered" : "Vehicle registered"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save asset";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isTrailer = form.is_trailer || form.category === "Trailer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTrailer ? <Container className="h-5 w-5 text-emerald-600" /> : <Truck className="h-5 w-5 text-primary" />}
            {machine ? (isTrailer ? "Edit Independent Trailer" : "Edit Vehicle") : (isTrailer ? "Add Independent Trailer" : "Add Vehicle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Asset Classification Selector (when adding new) */}
          {!machine && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Asset Classification
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.category === "Vehicle" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      category: "Vehicle",
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
                  variant={form.category === "Trailer" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      category: "Trailer",
                      is_trailer: true,
                      vehicle_type: "trailer",
                      axle_configuration: "trailer_tri",
                    }));
                  }}
                >
                  <Container className="h-4 w-4" /> Independent Trailer
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Photo Upload */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{isTrailer ? "Trailer Photo" : "Vehicle Photo"}</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Selected asset" className="h-full w-full object-cover" />
                  ) : (
                    <CoverImage
                      value={machine?.cover_image_url}
                      alt={form.name || "Asset"}
                      className="h-full w-full object-cover"
                      fallback={isTrailer ? <Container className="h-5 w-5 text-emerald-600" /> : <Truck className="h-5 w-5 text-muted-foreground" />}
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

            {/* Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{isTrailer ? "Trailer Name / Unit ID *" : "Vehicle Name *"}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={isTrailer ? "e.g. Tanker Semi-Trailer #01 (BPW)" : "e.g. Scania R500 Prime Mover"}
                maxLength={100}
              />
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
                  <SelectItem value="under_maintenance">Under maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Make */}
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder={isTrailer ? "e.g. CIMC / BPW / Afrit" : "e.g. Scania / Mercedes-Benz / Sinotruk"}
              />
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
              <Input type="number" step="any" value={form.current_odometer_km} onChange={(e) => setForm({ ...form, current_odometer_km: e.target.value })} />
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
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {machine ? t.common.save : (isTrailer ? "Add Independent Trailer" : t.fleet.addVehicle)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
